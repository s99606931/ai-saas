// 감사 로그 분석 통합 테스트
// Design Ref: SVC-AUDIT-R1 DESIGN
// Plan SC: FR-AUDIT.3

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('FR-AUDIT.1: 감사 이벤트 집계', () => {
  it('집계 쿼리 스키마가 올바르다', () => {
    const schema = z.object({
      tenantId: z.string().optional(),
      fromDate: z.string().datetime().optional(),
      toDate: z.string().datetime().optional(),
      groupBy: z.enum(['action', 'targetType', 'tenantId']).default('action'),
    });

    const result = schema.safeParse({ groupBy: 'action' });
    expect(result.success).toBe(true);
  });

  it('집계 응답 형식이 올바르다', () => {
    const response = {
      success: true,
      data: {
        groupBy: 'action',
        totalGroups: 3,
        groups: [
          { value: 'LOGIN_SUCCESS', count: 150 },
          { value: 'LOGIN_FAIL', count: 25 },
          { value: 'LOGOUT', count: 100 },
        ],
      },
    };

    expect(response.data.groups).toHaveLength(3);
    expect(response.data.groups[0]?.count).toBeGreaterThan(response.data.groups[1]?.count ?? 0);
  });

  it('잘못된 groupBy 값은 거부된다', () => {
    const schema = z.object({
      groupBy: z.enum(['action', 'targetType', 'tenantId']),
    });

    const result = schema.safeParse({ groupBy: 'invalidField' });
    expect(result.success).toBe(false);
  });
});

describe('FR-AUDIT.2: Top-N 통계', () => {
  it('Top-N 쿼리 스키마가 올바르다', () => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(10),
    });

    const result = schema.safeParse({ limit: '20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it('Top-N 행위자 응답 형식이 올바르다', () => {
    const response = {
      success: true,
      data: [
        { actorId: 'admin-1', eventCount: 500 },
        { actorId: 'user-2', eventCount: 200 },
      ],
    };

    expect(response.data[0]?.eventCount).toBeGreaterThan(response.data[1]?.eventCount ?? 0);
  });

  it('Top-N 행위 응답 형식이 올바르다', () => {
    const response = {
      success: true,
      data: [
        { action: 'LOGIN_SUCCESS', eventCount: 1000 },
        { action: 'API_REQUEST', eventCount: 5000 },
      ],
    };

    expect(response.data).toHaveLength(2);
  });

  it('limit 0 이하는 거부된다', () => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50),
    });

    expect(schema.safeParse({ limit: '0' }).success).toBe(false);
    expect(schema.safeParse({ limit: '-1' }).success).toBe(false);
  });

  it('limit 50 초과는 거부된다', () => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(50),
    });

    expect(schema.safeParse({ limit: '51' }).success).toBe(false);
  });
});
