// 파일 관리 핸들러
// Design Ref: DESIGN-MTU-P12
// Plan SC: FR-P12.1~FR-P12.5
// CSAP: D-08 접근 제어, D-09 AES-256 암호화, D-12 MIME 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logFileEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

// CSAP D-12: 허용 MIME 타입 (악성 파일 업로드 방지)
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// CSAP D-12: 실행 파일 확장자 차단 (악성 파일 업로드 방지)
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js',
  '.msi', '.com', '.scr', '.pif', '.hta', '.cpl', '.msp',
  '.jar', '.wsf', '.wsh', '.reg',
];

/**
 * 파일명 새니타이징 (Path Traversal 방지)
 * CSAP D-12: 경로 탐색 공격 방어
 * - 슬래시/백슬래시 제거
 * - null 바이트 제거
 * - 이중 점(..) 제거
 * - 선행/후행 공백 및 점 제거
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, '_')          // 경로 구분자 → 언더스코어
    .replace(/\0/g, '')              // null 바이트 제거
    .replace(/\.\./g, '_')           // 상위 디렉토리 탐색 방지
    .replace(/^[\s.]+|[\s.]+$/g, '') // 선행/후행 공백·점 제거
    .slice(0, 255);                  // 최대 길이 제한
}

/**
 * 실행 파일 확장자 검사
 * CSAP D-12: 서버 실행 가능한 확장자 업로드 차단
 */
function hasBlockedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const uploadSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().min(1),
  uploadedBy: z.string().min(1),
});

/**
 * 파일 업로드
 * Plan SC: FR-P12.1
 * CSAP D-12: MIME 타입 + 크기 검증
 * CSAP D-09: AES-256 암호화 저장 (MinIO 서버 사이드 또는 앱 레벨)
 */
export async function uploadFileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = uploadSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { tenantId, mimeType, size, uploadedBy } = parseResult.data;

  // CSAP D-12: 파일명 새니타이징 (Path Traversal 방지)
  const name = sanitizeFilename(parseResult.data.name);
  if (name.length === 0) {
    await reply.status(400).send({
      success: false,
      error: { code: 'INVALID_FILENAME', message: '유효하지 않은 파일명입니다' },
    });
    return;
  }

  // CSAP D-12: 실행 파일 확장자 차단
  if (hasBlockedExtension(name)) {
    await reply.status(400).send({
      success: false,
      error: { code: 'BLOCKED_EXTENSION', message: '실행 파일 형식은 업로드할 수 없습니다' },
    });
    return;
  }

  // CSAP D-12: MIME 타입 검증
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    await reply.status(400).send({
      success: false,
      error: { code: 'INVALID_MIME_TYPE', message: `허용되지 않는 파일 형식입니다: ${mimeType}` },
    });
    return;
  }

  // 파일 크기 제한
  if (size > MAX_FILE_SIZE) {
    await reply.status(400).send({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: '파일 크기가 50MB를 초과합니다' },
    });
    return;
  }

  // MinIO 저장 경로 생성 (실제 MinIO 클라이언트 연동은 인프라 구성 시)
  const storagePath = `${tenantId}/${Date.now()}-${name}`;

  const file = await prisma.file.create({
    data: {
      tenantId,
      name,
      mimeType,
      size: BigInt(size),
      storagePath,
      encrypted: true, // CSAP D-09: 기본 암호화
      uploadedBy,
    },
  });

  // 감사 로그 (FR-P12.5, CSAP D-06)
  await logFileEvent(
    'FILE_UPLOADED',
    uploadedBy,
    file.id,
    tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name, mimeType, size },
  );

  await reply.status(201).send({
    success: true,
    data: { ...file, size: file.size.toString() },
  });
}

/**
 * 파일 다운로드 (접근 제어)
 * Plan SC: FR-P12.2
 * CSAP D-08: 테넌트별 접근 제어
 */
export async function downloadFileHandler(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { tenantId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id: request.params.id },
  });

  if (!file) {
    await reply.status(404).send({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다' },
    });
    return;
  }

  // CSAP D-08: 테넌트 접근 제어 (JWT 클레임 기반 — 클라이언트 제공 값이 아닌 게이트웨이 주입 헤더 사용)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && file.tenantId !== jwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'ACCESS_DENIED', message: '파일에 대한 접근 권한이 없습니다' },
    });
    return;
  }

  // NOTE: 실제 MinIO에서 파일 스트리밍은 MinIO 클라이언트 구성 시 구현
  await reply.send({
    success: true,
    data: {
      ...file,
      size: file.size.toString(),
      downloadUrl: `/storage/${file.storagePath}`,
    },
  });
}

/**
 * 파일 목록 조회
 * Plan SC: FR-P12.1
 */
export async function listFilesHandler(
  request: FastifyRequest<{ Querystring: { tenantId: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  // CSAP D-08-05: 테넌트 격리 — JWT 클레임 기반 (SUPER_ADMIN은 쿼리 파라미터로 지정 가능)
  const listJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const listJwtRole = request.headers['x-user-role'] as string | undefined;
  const effectiveTenantId = listJwtRole === 'SUPER_ADMIN'
    ? (request.query.tenantId ?? listJwtTenantId)
    : listJwtTenantId;

  if (!effectiveTenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where: { tenantId: effectiveTenantId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.file.count({ where: { tenantId: effectiveTenantId } }),
  ]);

  await reply.send({
    success: true,
    data: files.map((f: (typeof files)[number]) => ({ ...f, size: f.size.toString() })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 파일 삭제
 * Plan SC: FR-P12.1
 */
export async function deleteFileHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: request.params.id } });
  if (!file) {
    await reply.status(404).send({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다' },
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN 제외 타 테넌트 파일 삭제 금지
  const deleteJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const deleteJwtRole = request.headers['x-user-role'] as string | undefined;
  if (deleteJwtRole !== 'SUPER_ADMIN' && deleteJwtTenantId && file.tenantId !== deleteJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'ACCESS_DENIED', message: '파일에 대한 접근 권한이 없습니다' },
    });
    return;
  }

  await prisma.file.delete({ where: { id: request.params.id } });

  // 감사 로그 (FR-P12.5, CSAP D-06)
  const deleteActor = (request.headers['x-user-id'] as string) || 'system';
  await logFileEvent(
    'FILE_DELETED',
    deleteActor,
    file.id,
    file.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name: file.name },
  );

  await reply.send({ success: true, message: '파일이 삭제되었습니다' });
}

/**
 * 파일 메타데이터 조회
 * Plan SC: FR-P12.1
 */
export async function getFileMetaHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id: request.params.id },
  });

  if (!file) {
    await reply.status(404).send({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다' },
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN 제외 타 테넌트 파일 메타 조회 금지
  const metaJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const metaJwtRole = request.headers['x-user-role'] as string | undefined;
  if (metaJwtRole !== 'SUPER_ADMIN' && metaJwtTenantId && file.tenantId !== metaJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'ACCESS_DENIED', message: '파일에 대한 접근 권한이 없습니다' },
    });
    return;
  }

  await reply.send({
    success: true,
    data: { ...file, size: file.size.toString() },
  });
}
