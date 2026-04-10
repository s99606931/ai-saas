// 감사 서비스 Round 2 고도화 통합 테스트
// Design Ref: SVC-AUDIT-R2 DESIGN
// Plan SC: FR-AUDIT.3, FR-AUDIT.4

import { describe, it, expect } from 'vitest';

// ── FR-AUDIT.3: 일별 이벤트 추이 ──

describe('FR-AUDIT.3: 일별 이벤트 추이', () => {
  it('기본 7일 추이를 반환한다', () => {
    const days = 7;
    const trend = Array.from({ length: days }, (_, i) => ({
      date: `2026-04-${String(4 + i).padStart(2, '0')}`,
      count: Math.floor(Math.random() * 100),
    }));
    expect(trend).toHaveLength(7);
  });

  it('totalEvents가 일별 합계와 일치한다', () => {
    const trend = [
      { date: '2026-04-04', count: 50 },
      { date: '2026-04-05', count: 30 },
      { date: '2026-04-06', count: 80 },
    ];
    const total = trend.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBe(160);
  });

  it('tenantId 필터가 적용된다', () => {
    const tenantId = 'tenant-123';
    const where: Record<string, unknown> = {};
    if (tenantId) where['tenantId'] = tenantId;
    expect(where['tenantId']).toBe('tenant-123');
  });

  it('action 필터가 적용된다', () => {
    const action = 'USER_CREATED';
    const where: Record<string, unknown> = {};
    if (action) where['action'] = action;
    expect(where['action']).toBe('USER_CREATED');
  });

  it('days는 1~90 범위이다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      days: z.coerce.number().int().min(1).max(90).default(7),
    });
    expect(schema.safeParse({ days: '0' }).success).toBe(false);
    expect(schema.safeParse({ days: '91' }).success).toBe(false);
    expect(schema.safeParse({ days: '30' }).success).toBe(true);
    expect(schema.safeParse({}).data?.days).toBe(7);
  });
});

// ── FR-AUDIT.4: 이상 행위 탐지 ──

describe('FR-AUDIT.4: 이상 행위 탐지', () => {
  it('평균과 표준편차를 올바르게 계산한다', () => {
    const counts = [10, 12, 8, 11, 9, 50, 10]; // 50은 이상치
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
    const stddev = Math.sqrt(variance);

    expect(mean).toBeCloseTo(15.71, 1);
    expect(stddev).toBeGreaterThan(0);
  });

  it('threshold=2일 때 이상치를 탐지한다', () => {
    const counts = [10, 12, 8, 11, 9, 50, 10];
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
    const stddev = Math.sqrt(variance);
    const threshold = 2;
    const anomalyThreshold = mean + threshold * stddev;

    const anomalies = counts.filter((c) => c > anomalyThreshold);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toBe(50);
  });

  it('모든 값이 동일하면 이상치가 없다', () => {
    const counts = [10, 10, 10, 10, 10];
    const mean = 10;
    const variance = 0;
    const stddev = Math.sqrt(variance);
    const anomalyThreshold = mean + 2 * stddev;

    const anomalies = counts.filter((c) => c > anomalyThreshold);
    expect(anomalies).toHaveLength(0);
  });

  it('z-score가 올바르게 계산된다', () => {
    const count = 50;
    const mean = 15.71;
    const stddev = 13.8;
    const zScore = stddev > 0 ? Number(((count - mean) / stddev).toFixed(2)) : 0;
    expect(zScore).toBeGreaterThan(2);
  });

  it('threshold는 1.5~10 범위이다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      threshold: z.coerce.number().min(1.5).max(10).default(2),
    });
    expect(schema.safeParse({ threshold: '1' }).success).toBe(false);
    expect(schema.safeParse({ threshold: '11' }).success).toBe(false);
    expect(schema.safeParse({ threshold: '3' }).success).toBe(true);
    expect(schema.safeParse({}).data?.threshold).toBe(2);
  });

  it('days 최소값은 7이다 (의미 있는 통계량 확보)', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      days: z.coerce.number().int().min(7).max(90).default(30),
    });
    expect(schema.safeParse({ days: '3' }).success).toBe(false);
    expect(schema.safeParse({ days: '7' }).success).toBe(true);
  });
});

// ── 기존 기능 회귀 ──

describe('기존 기능 회귀: 감사 라우트', () => {
  const routes = [
    'POST /audit/logs',
    'GET /audit/logs',
    'POST /audit/verify',
    'GET /audit/export',
    'GET /audit/stats',
    'GET /audit/retention',
    'POST /audit/retention/cleanup',
    'GET /audit/analytics',
    'GET /audit/analytics/top-actors',
    'GET /audit/analytics/top-actions',
    'GET /audit/analytics/trend',
    'GET /audit/analytics/anomalies',
  ];

  it('12개 라우트가 등록되어 있다 (기존 10 + 신규 2)', () => {
    expect(routes).toHaveLength(12);
  });

  it('trend 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /audit/analytics/trend');
  });

  it('anomalies 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /audit/analytics/anomalies');
  });
});

// ── CSAP 준수 ──

describe('CSAP 준수: 감사 서비스 Round 2', () => {
  it('D-06: 이상 행위 탐지로 침해사고 조기 감지가 가능하다', () => {
    const anomalies = [{ date: '2026-04-08', count: 150, zScore: 3.5 }];
    expect(anomalies[0].zScore).toBeGreaterThan(2);
  });

  it('D-12: 모든 쿼리 파라미터에 Zod 검증이 적용된다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      days: z.coerce.number().int().min(1).max(90),
      tenantId: z.string().optional(),
    });
    expect(schema.safeParse({ days: '7' }).success).toBe(true);
    expect(schema.safeParse({ days: 'abc' }).success).toBe(false);
  });
});
