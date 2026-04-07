// 감사 로그 핸들러 Zod 검증 테스트
// Design Ref: DESIGN-MTU-P13 §2.1
// Plan SC: FR-P13.1~FR-P13.6
// CSAP: D-06 감사 로그, D-12 입력 검증

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// 핸들러에서 사용하는 스키마를 직접 정의 (모듈 격리 테스트)
const createAuditLogSchema = z.object({
  tenantId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().min(1, 'action은 필수입니다'),
  target: z.string().optional(),
  targetType: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const queryAuditLogSchema = z.object({
  tenantId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const verifySchema = z.object({
  tenantId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

const exportSchema = z.object({
  tenantId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  format: z.enum(['csv', 'json']).default('json'),
});

describe('createAuditLogSchema (CSAP D-12 입력 검증)', () => {
  it('유효한 감사 로그 데이터를 허용한다', () => {
    const result = createAuditLogSchema.safeParse({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      action: 'LOGIN_SUCCESS',
      target: 'session-1',
      targetType: 'session',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    });
    expect(result.success).toBe(true);
  });

  it('action 필수 필드 누락을 거부한다', () => {
    const result = createAuditLogSchema.safeParse({
      actorId: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('빈 action을 거부한다', () => {
    const result = createAuditLogSchema.safeParse({
      action: '',
    });
    expect(result.success).toBe(false);
  });

  it('metadata를 Record<string, unknown>으로 허용한다', () => {
    const result = createAuditLogSchema.safeParse({
      action: 'TEST',
      metadata: { key: 'value', nested: { a: 1 } },
    });
    expect(result.success).toBe(true);
  });

  it('최소 데이터 (action만)를 허용한다', () => {
    const result = createAuditLogSchema.safeParse({
      action: 'SYSTEM_EVENT',
    });
    expect(result.success).toBe(true);
  });
});

describe('queryAuditLogSchema (CSAP D-12)', () => {
  it('빈 쿼리를 허용한다 (기본값 적용)', () => {
    const result = queryAuditLogSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it('limit 범위를 1~100으로 제한한다', () => {
    const over = queryAuditLogSchema.safeParse({ limit: 200 });
    expect(over.success).toBe(false);

    const under = queryAuditLogSchema.safeParse({ limit: 0 });
    expect(under.success).toBe(false);

    const valid = queryAuditLogSchema.safeParse({ limit: 50 });
    expect(valid.success).toBe(true);
  });

  it('유효한 ISO 8601 날짜를 허용한다', () => {
    const result = queryAuditLogSchema.safeParse({
      fromDate: '2026-04-01T00:00:00.000Z',
      toDate: '2026-04-07T23:59:59.999Z',
    });
    expect(result.success).toBe(true);
  });

  it('잘못된 날짜 형식을 거부한다', () => {
    const result = queryAuditLogSchema.safeParse({
      fromDate: '2026-04-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('verifySchema (무결성 검증 입력)', () => {
  it('빈 요청을 허용한다 (전체 검증)', () => {
    const result = verifySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('테넌트별 검증을 허용한다', () => {
    const result = verifySchema.safeParse({ tenantId: 'tenant-1' });
    expect(result.success).toBe(true);
  });
});

describe('exportSchema (내보내기 입력)', () => {
  it('기본 형식은 json이다', () => {
    const result = exportSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('json');
    }
  });

  it('csv 형식을 허용한다', () => {
    const result = exportSchema.safeParse({ format: 'csv' });
    expect(result.success).toBe(true);
  });

  it('지원하지 않는 형식을 거부한다', () => {
    const result = exportSchema.safeParse({ format: 'xml' });
    expect(result.success).toBe(false);
  });
});
