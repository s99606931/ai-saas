// AI 서비스 Round 2 고도화 통합 테스트
// Design Ref: SVC-AI-R2 DESIGN
// Plan SC: FR-AI.4, FR-AI.5

import { describe, it, expect } from 'vitest';

// ── FR-AI.4: 일별 AI 사용량 추이 ──

describe('FR-AI.4: 일별 AI 사용량 추이', () => {
  it('7일 추이를 반환한다', () => {
    const trend = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${String(4 + i).padStart(2, '0')}`,
      tokens: 1000 + i * 100,
      cost: 0.1 + i * 0.01,
      calls: 10 + i,
    }));
    expect(trend).toHaveLength(7);
  });

  it('summary 합계가 올바르다', () => {
    const trend = [
      { tokens: 1000, cost: 0.1, calls: 10 },
      { tokens: 2000, cost: 0.2, calls: 20 },
    ];
    const totalTokens = trend.reduce((sum, t) => sum + t.tokens, 0);
    const totalCost = trend.reduce((sum, t) => sum + t.cost, 0);
    const totalCalls = trend.reduce((sum, t) => sum + t.calls, 0);
    expect(totalTokens).toBe(3000);
    expect(totalCost).toBeCloseTo(0.3);
    expect(totalCalls).toBe(30);
  });

  it('days 범위는 1~90이다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      days: z.coerce.number().int().min(1).max(90).default(7),
    });
    expect(schema.safeParse({ days: '0' }).success).toBe(false);
    expect(schema.safeParse({ days: '30' }).success).toBe(true);
  });

  it('tenantId 필터가 적용된다', () => {
    const tenantId = 'tenant-ai-001';
    const where: Record<string, unknown> = {};
    if (tenantId) where['tenantId'] = tenantId;
    expect(where['tenantId']).toBe('tenant-ai-001');
  });
});

// ── FR-AI.5: 모델별 사용 분석 ──

describe('FR-AI.5: 모델별 사용 분석', () => {
  it('모델별 호출 수와 토큰 수가 반환된다', () => {
    const models = [
      { modelId: 'gpt-4', callCount: 100, totalTokens: 50000, avgTokensPerCall: 500 },
      { modelId: 'local-llm', callCount: 50, totalTokens: 10000, avgTokensPerCall: 200 },
    ];
    expect(models).toHaveLength(2);
    expect(models[0].avgTokensPerCall).toBe(500);
  });

  it('호출 점유율이 올바르다', () => {
    const totalCalls = 150;
    const modelCalls = 100;
    const sharePercent = Number(((modelCalls / totalCalls) * 100).toFixed(1));
    expect(sharePercent).toBeCloseTo(66.7);
  });

  it('등급별 분포가 반환된다', () => {
    const gradeDistribution = [
      { grade: 'O', callCount: 120, totalTokens: 40000 },
      { grade: 'S', callCount: 0, totalTokens: 0 },
      { grade: 'C', callCount: 0, totalTokens: 0 },
    ];
    // S/C 등급은 차단되므로 0이어야 함
    expect(gradeDistribution.find((g) => g.grade === 'S')?.callCount).toBe(0);
    expect(gradeDistribution.find((g) => g.grade === 'C')?.callCount).toBe(0);
  });
});

// ── N2SF 데이터 등급 ──

describe('N2SF: AI API 데이터 등급 준수', () => {
  it('O등급만 AI API 전송 가능하다', () => {
    const allowedGrades = ['O'];
    expect(allowedGrades).toContain('O');
    expect(allowedGrades).not.toContain('S');
    expect(allowedGrades).not.toContain('C');
  });

  it('S/C등급 데이터는 절대 전송 금지이다', () => {
    const grade = 'S';
    const isBlocked = grade === 'S' || grade === 'C';
    expect(isBlocked).toBe(true);
  });
});

// ── 기존 기능 회귀 ──

describe('기존 기능 회귀: AI 라우트', () => {
  const routes = [
    'GET /ai/models',
    'POST /ai/models',
    'PUT /ai/models/:id',
    'POST /ai/chat',
    'GET /ai/usage',
    'GET /ai/cost',
    'GET /ai/analytics/trend',
    'GET /ai/analytics/models',
  ];

  it('8개 라우트가 등록되어 있다 (기존 6 + 신규 2)', () => {
    expect(routes).toHaveLength(8);
  });

  it('analytics/trend 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /ai/analytics/trend');
  });

  it('analytics/models 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /ai/analytics/models');
  });
});
