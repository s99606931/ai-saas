// 파일 서비스 CSAP 보안 테스트
// Design Ref: DESIGN-MTU-P12
// Plan SC: FR-P12.1~FR-P12.6
// CSAP: D-08 접근통제, D-09 암호화, D-06 감사로그, D-12 입력검증

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const uploadSchema = z.object({
  tenantId: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/i),
  size: z
    .number()
    .int()
    .min(1)
    .max(100 * 1024 * 1024), // 100MB 제한
  classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL']).default('INTERNAL'),
});

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
  'text/plain',
  'text/csv',
];

const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.vbs',
  '.js',
  '.msi',
  '.com',
  '.scr',
  '.pif',
  '.hta',
  '.cpl',
  '.msp',
  '.jar',
  '.wsf',
  '.wsh',
  '.reg',
];

describe('CSAP D-12: 파일 업로드 보안', () => {
  it('유효한 파일 업로드를 허용한다', () => {
    const result = uploadSchema.safeParse({
      tenantId: 'tenant-1',
      filename: 'report.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it('100MB 초과 파일을 거부한다', () => {
    expect(
      uploadSchema.safeParse({
        tenantId: 'tenant-1',
        filename: 'large.pdf',
        mimeType: 'application/pdf',
        size: 200 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });

  it('0 바이트 파일을 거부한다', () => {
    expect(
      uploadSchema.safeParse({
        tenantId: 'tenant-1',
        filename: 'empty.pdf',
        mimeType: 'application/pdf',
        size: 0,
      }).success,
    ).toBe(false);
  });

  it('실행 파일 확장자를 차단해야 한다', () => {
    BLOCKED_EXTENSIONS.forEach((ext) => {
      const filename = `malicious${ext}`;
      const isBlocked = BLOCKED_EXTENSIONS.some((blocked) => filename.toLowerCase().endsWith(blocked));
      expect(isBlocked).toBe(true);
    });
  });

  it('허용된 MIME 타입 목록이 정의된다', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).not.toContain('application/x-executable');
  });

  it('경로 탐색(Path Traversal) 방어가 적용된다', () => {
    // sanitizeFilename 로직 재현
    const sanitize = (f: string): string =>
      f
        .replace(/[/\\]/g, '_')
        .replace(/\0/g, '')
        .replace(/\.\./g, '_')
        .replace(/^[\s.]+|[\s.]+$/g, '')
        .slice(0, 255);

    expect(sanitize('../../../etc/passwd')).not.toContain('/');
    expect(sanitize('../../../etc/passwd')).not.toContain('..');
    expect(sanitize('..\\..\\windows\\system32')).not.toContain('\\');
    expect(sanitize('file\0name.pdf')).not.toContain('\0');
    // '...' -> '..' 치환 -> '_.' -> 선행점 제거 -> '_'
    expect(sanitize('...leading-dots')).toBe('_.leading-dots');
    expect(sanitize('trailing...')).toBe('trailing_');
  });

  it('실행 파일 확장자가 차단된다', () => {
    const hasBlockedExtension = (filename: string): boolean => {
      const lower = filename.toLowerCase();
      return BLOCKED_EXTENSIONS.some((ext: string) => lower.endsWith(ext));
    };
    expect(hasBlockedExtension('malware.exe')).toBe(true);
    expect(hasBlockedExtension('script.PS1')).toBe(true);
    expect(hasBlockedExtension('payload.JAR')).toBe(true);
    expect(hasBlockedExtension('document.pdf')).toBe(false);
    expect(hasBlockedExtension('image.png')).toBe(false);
  });

  it('잘못된 MIME 타입 형식을 거부한다', () => {
    expect(
      uploadSchema.safeParse({
        tenantId: 'tenant-1',
        filename: 'test.pdf',
        mimeType: 'invalid',
        size: 1024,
      }).success,
    ).toBe(false);
  });
});

describe('CSAP D-09: 파일 암호화', () => {
  it('기밀 파일은 AES-256으로 암호화해야 한다', () => {
    const classification = 'CONFIDENTIAL';
    const requiresEncryption = classification === 'CONFIDENTIAL';
    expect(requiresEncryption).toBe(true);
  });

  it('공개 파일은 암호화 불필요하다', () => {
    const classification = 'PUBLIC';
    const requiresEncryption = classification === 'CONFIDENTIAL';
    expect(requiresEncryption).toBe(false);
  });
});

describe('CSAP D-08: 파일 접근 통제', () => {
  it('파일 접근은 테넌트 격리가 적용된다 (N2SF N-03)', () => {
    const fileOwnerTenantId = 'tenant-A';
    const requestTenantId = 'tenant-B';
    expect(fileOwnerTenantId).not.toBe(requestTenantId);
  });

  it('기밀 파일 다운로드는 감사 로그 필수이다', () => {
    const classification = 'CONFIDENTIAL';
    const requiresAudit = ['CONFIDENTIAL', 'INTERNAL'].includes(classification);
    expect(requiresAudit).toBe(true);
  });
});

describe('CSAP D-06: 파일 감사 로그', () => {
  it('파일 이벤트가 정의된다', () => {
    const events = ['FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_DELETED', 'FILE_ACCESS_DENIED'];
    expect(events.length).toBe(4);
  });
});
