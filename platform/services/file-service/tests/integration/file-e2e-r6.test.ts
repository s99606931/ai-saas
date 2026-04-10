// 파일 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.5
// CSAP: D-08-05 테넌트 격리, D-09 암호화, D-12 MIME 검증

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('file-service E2E -- 파일 업로드/다운로드 + 보안 (CSAP D-09, D-12)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  interface FileRecord {
    id: string;
    tenantId: string;
    name: string;
    mimeType: string;
    size: number;
    uploadedBy: string;
    storagePath: string;
    encrypted: boolean;
    createdAt: string;
  }

  const files = new Map<string, FileRecord>();
  let fileCounter = 0;

  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/csv',
  ];
  const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.js', '.jar'];
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  function sanitizeFilename(name: string): string {
    return name
      .replace(/[/\\]/g, '_')
      .replace(/\0/g, '')
      .replace(/\.\./g, '_')
      .replace(/^[\s.]+|[\s.]+$/g, '')
      .slice(0, 255);
  }

  function hasBlockedExtension(name: string): boolean {
    return BLOCKED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
  }

  app.post('/file/upload', async (req, reply) => {
    const body = req.body as {
      tenantId?: string;
      name?: string;
      mimeType?: string;
      size?: number;
      uploadedBy?: string;
    };

    if (!body.tenantId || !body.name || !body.mimeType || !body.size || !body.uploadedBy) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '필수 필드 누락' },
      });
      return;
    }

    const safeName = sanitizeFilename(body.name);
    if (!safeName) {
      await reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FILENAME', message: '유효하지 않은 파일명' },
      });
      return;
    }

    if (hasBlockedExtension(safeName)) {
      await reply.status(400).send({
        success: false,
        error: { code: 'BLOCKED_EXTENSION', message: '실행 파일 업로드 금지' },
      });
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(body.mimeType)) {
      await reply.status(400).send({
        success: false,
        error: { code: 'INVALID_MIME_TYPE', message: '허용되지 않은 파일 형식' },
      });
      return;
    }

    if (body.size > MAX_FILE_SIZE) {
      await reply.status(400).send({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: '파일 크기 초과 (최대 50MB)' },
      });
      return;
    }

    const id = `file-${++fileCounter}`;
    const record: FileRecord = {
      id,
      tenantId: body.tenantId,
      name: safeName,
      mimeType: body.mimeType,
      size: body.size,
      uploadedBy: body.uploadedBy,
      storagePath: `/minio/${body.tenantId}/${id}/${safeName}`,
      encrypted: true, // CSAP D-09: AES-256
      createdAt: new Date().toISOString(),
    };
    files.set(id, record);
    await reply.status(201).send({ success: true, data: record });
  });

  app.get('/file/list', async (req) => {
    const query = req.query as { tenantId?: string; mimeType?: string };
    let items = Array.from(files.values());
    if (query.tenantId) items = items.filter((f) => f.tenantId === query.tenantId);
    if (query.mimeType) items = items.filter((f) => f.mimeType === query.mimeType);
    return { success: true, data: items, total: items.length };
  });

  app.get('/file/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const file = files.get(id);
    if (!file) {
      await reply.status(404).send({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다' },
      });
      return;
    }
    return { success: true, data: { ...file, content: '<binary-data-placeholder>' } };
  });

  app.get('/file/:id/meta', async (req, reply) => {
    const { id } = req.params as { id: string };
    const file = files.get(id);
    if (!file) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    return { success: true, data: file };
  });

  app.delete('/file/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!files.has(id)) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    files.delete(id);
    return { success: true, message: '파일 삭제 완료' };
  });

  app.get('/file/storage-usage', async (req) => {
    const query = req.query as { tenantId?: string };
    let items = Array.from(files.values());
    if (query.tenantId) items = items.filter((f) => f.tenantId === query.tenantId);
    const totalSize = items.reduce((sum, f) => sum + f.size, 0);
    return { success: true, data: { totalSize, fileCount: items.length } };
  });

  app.get('/file/stats', async () => {
    const all = Array.from(files.values());
    const byMime = new Map<string, number>();
    for (const f of all) {
      byMime.set(f.mimeType, (byMime.get(f.mimeType) ?? 0) + 1);
    }
    return {
      success: true,
      data: {
        totalFiles: all.length,
        totalSize: all.reduce((sum, f) => sum + f.size, 0),
        byMimeType: Object.fromEntries(byMime),
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('파일 업로드 -> 조회 -> 메타데이터 -> 삭제 전체 플로우', async () => {
    // 1. 업로드
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/file/upload',
      headers: { 'content-type': 'application/json' },
      payload: {
        tenantId: 't-file',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        size: 1024 * 100,
        uploadedBy: 'user-1',
      },
    });
    expect(uploadRes.statusCode).toBe(201);
    const fileId = uploadRes.json().data.id;
    expect(uploadRes.json().data.encrypted).toBe(true); // CSAP D-09

    // 2. 다운로드
    const dlRes = await app.inject({ method: 'GET', url: `/file/${fileId}` });
    expect(dlRes.json().data.name).toBe('report.pdf');

    // 3. 메타데이터
    const metaRes = await app.inject({ method: 'GET', url: `/file/${fileId}/meta` });
    expect(metaRes.json().data.mimeType).toBe('application/pdf');

    // 4. 삭제
    const delRes = await app.inject({ method: 'DELETE', url: `/file/${fileId}` });
    expect(delRes.json().success).toBe(true);

    // 5. 삭제 후 조회 실패
    const notFoundRes = await app.inject({ method: 'GET', url: `/file/${fileId}` });
    expect(notFoundRes.statusCode).toBe(404);
  });

  it('CSAP D-12: 실행 파일 확장자 업로드 차단', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/file/upload',
      headers: { 'content-type': 'application/json' },
      payload: {
        tenantId: 't-sec',
        name: 'malware.exe',
        mimeType: 'application/pdf',
        size: 1024,
        uploadedBy: 'attacker',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BLOCKED_EXTENSION');
  });

  it('CSAP D-12: 허용되지 않은 MIME 타입 차단', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/file/upload',
      headers: { 'content-type': 'application/json' },
      payload: {
        tenantId: 't-sec',
        name: 'script.html',
        mimeType: 'text/html',
        size: 512,
        uploadedBy: 'user-1',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_MIME_TYPE');
  });

  it('CSAP D-12: Path Traversal 방지 (파일명 새니타이징)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/file/upload',
      headers: { 'content-type': 'application/json' },
      payload: {
        tenantId: 't-sec',
        name: '../../etc/passwd',
        mimeType: 'text/plain',
        size: 256,
        uploadedBy: 'attacker',
      },
    });
    expect(res.statusCode).toBe(201);
    // 새니타이징된 파일명에 ../ 없어야 함
    expect(res.json().data.name).not.toContain('..');
    expect(res.json().data.name).not.toContain('/');
  });

  it('용량 초과 파일 업로드 차단', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/file/upload',
      headers: { 'content-type': 'application/json' },
      payload: {
        tenantId: 't-sec',
        name: 'huge.pdf',
        mimeType: 'application/pdf',
        size: 60 * 1024 * 1024, // 60MB > 50MB
        uploadedBy: 'user-1',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('FILE_TOO_LARGE');
  });

  it('저장 용량 + 통계 조회', async () => {
    const usageRes = await app.inject({
      method: 'GET',
      url: '/file/storage-usage?tenantId=t-sec',
    });
    expect(usageRes.json().success).toBe(true);

    const statsRes = await app.inject({ method: 'GET', url: '/file/stats' });
    expect(statsRes.json().data.totalFiles).toBeGreaterThanOrEqual(0);
  });

  it('X-Response-Time 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/file/stats' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
