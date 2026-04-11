// 감사 로그 스키마 검증 단위 테스트
// Design Ref: DESIGN-MTU-P13 §2.1
// CSAP: D-06 감사 로그, D-12 입력 검증

import { describe, it, expect } from 'vitest';
import {
  createAuditLogSchema,
  queryAuditLogSchema,
  exportAuditLogSchema,
  verifyIntegritySchema,
} from '../../src/schemas/audit.schema.js';

// -- createAuditLogSchema ─────────────────────────────────────────────────

describe('createAuditLogSchema (CSAP D-06)', () => {
  it('유효한 최소 요청을 허용한다', () => {
    expect(createAuditLogSchema.safeParse({ action: 'USER_LOGIN' }).success).toBe(true);
  });

  it('모든 필��를 포함한 요청을 허용한다', () => {
    expect(createAuditLogSchema.safeParse({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      action: 'USER_DELETE',
      target: 'user-123',
      targetType: 'user',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      metadata: { reason: '계정 해지' },
    }).success).toBe(true);
  });

  it('action 누락을 거부한다', () => {
    expect(createAuditLogSchema.safeParse({}).success).toBe(false);
  });

  it('빈 action을 거부한다', () => {
    expect(createAuditLogSchema.safeParse({ action: '' }).success).toBe(false);
  });

  it('action 100자 초과를 거부한다', () => {
    expect(createAuditLogSchema.safeParse({ action: 'a'.repeat(101) }).success).toBe(false);
  });

  it('잘못된 UUID 형식의 tenantId를 거부한다', () => {
    expect(createAuditLogSchema.safeParse({
      tenantId: 'not-a-uuid',
      action: 'TEST',
    }).success).toBe(false);
  });

  it('잘못된 UUID 형식의 actorId를 거부한다', () => {
    expect(createAuditLogSchema.safeParse({
      actorId: 'invalid',
      action: 'TEST',
    }).success).toBe(false);
  });

  it('target 255자 초과를 거부한다', () => {
    expect(createAuditLogSchema.safeParse({
      action: 'TEST',
      target: 'a'.repeat(256),
    }).success).toBe(false);
  });

  it('ip 45자 초과를 거부한다 (IPv6 최대 길이)', () => {
    expect(createAuditLogSchema.safeParse({
      action: 'TEST',
      ip: 'a'.repeat(46),
    }).success).toBe(false);
  });

  it('userAgent 500자 초과를 거부한다', () => {
    expect(createAuditLogSchema.safeParse({
      action: 'TEST',
      userAgent: 'a'.repeat(501),
    }).success).toBe(false);
  });
});

// -- queryAuditLogSchema ──────────────────────────────────────────────────

describe('queryAuditLogSchema', () => {
  it('빈 쿼리를 허용한다 (기본값 적용)', () => {
    const result = queryAuditLogSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('모든 필터를 포함한 쿼리를 허용한다', () => {
    expect(queryAuditLogSchema.safeParse({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'USER_LOGIN',
      page: 2,
      limit: 50,
    }).success).toBe(true);
  });

  it('page 0을 거부한다', () => {
    expect(queryAuditLogSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('limit 101을 거부한다 (최대 100)', () => {
    expect(queryAuditLogSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('문자열 page를 숫자로 변환한다 (coerce)', () => {
    const result = queryAuditLogSchema.safeParse({ page: '3' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
    }
  });
});

// -- exportAuditLogSchema ─────────────────────────────────────────────────

describe('exportAuditLogSchema', () => {
  it('빈 요청을 허용한다 (기본값 json)', () => {
    const result = exportAuditLogSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('json');
    }
  });

  it('csv 형식을 허용한다', () => {
    const result = exportAuditLogSchema.safeParse({ format: 'csv' });
    expect(result.success).toBe(true);
  });

  it('지원하지 않는 형식을 거부한다', () => {
    expect(exportAuditLogSchema.safeParse({ format: 'xml' }).success).toBe(false);
  });
});

// -- verifyIntegritySchema ────────────────────────────────────────────────

describe('verifyIntegritySchema', () => {
  it('빈 요청을 허용한다', () => {
    expect(verifyIntegritySchema.safeParse({}).success).toBe(true);
  });

  it('tenantId 필터를 허용한다', () => {
    expect(verifyIntegritySchema.safeParse({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
    }).success).toBe(true);
  });

  it('��못된 UUID를 거부한다', () => {
    expect(verifyIntegritySchema.safeParse({
      tenantId: 'bad-uuid',
    }).success).toBe(false);
  });
});
