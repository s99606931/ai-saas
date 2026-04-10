// 파일 서비스 스키마 테스트
// Design Ref: DESIGN-MTU-P12
// Plan SC: FR-P12.1~FR-P12.4
// CSAP: D-09, D-12

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const uploadSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().min(1),
  uploadedBy: z.string().min(1),
});

describe('uploadSchema (CSAP D-12 입력 검증)', () => {
  it('유효한 파일 업로드 요청을 허용한다', () => {
    const result = uploadSchema.safeParse({
      tenantId: 'tenant-1',
      name: 'document.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      uploadedBy: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('빈 파일명을 거부한다', () => {
    expect(
      uploadSchema.safeParse({
        tenantId: 't1',
        name: '',
        mimeType: 'text/plain',
        size: 1,
        uploadedBy: 'u1',
      }).success,
    ).toBe(false);
  });

  it('파일명 255자 초과를 거부한다', () => {
    expect(
      uploadSchema.safeParse({
        tenantId: 't1',
        name: 'a'.repeat(256),
        mimeType: 'text/plain',
        size: 1,
        uploadedBy: 'u1',
      }).success,
    ).toBe(false);
  });

  it('크기 0을 거부한다 (빈 파일)', () => {
    expect(
      uploadSchema.safeParse({
        tenantId: 't1',
        name: 'f.txt',
        mimeType: 'text/plain',
        size: 0,
        uploadedBy: 'u1',
      }).success,
    ).toBe(false);
  });

  it('음수 크기를 거부한다', () => {
    expect(
      uploadSchema.safeParse({
        tenantId: 't1',
        name: 'f.txt',
        mimeType: 'text/plain',
        size: -1,
        uploadedBy: 'u1',
      }).success,
    ).toBe(false);
  });

  it('필수 필드 누락을 거부한다', () => {
    expect(uploadSchema.safeParse({ name: 'f.txt' }).success).toBe(false);
  });
});
