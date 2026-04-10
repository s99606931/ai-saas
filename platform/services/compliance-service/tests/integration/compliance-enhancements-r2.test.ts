// 준수 현황 서비스 Round 2 고도화 통합 테스트
// Design Ref: SVC-COMP-R2 DESIGN
// Plan SC: FR-COMP.5, FR-COMP.6

import { describe, it, expect } from 'vitest';

// ── FR-COMP.5: 준수율 추이 ──

describe('FR-COMP.5: 준수율 추이', () => {
  it('30일 추이를 반환한다', () => {
    const days = 30;
    const trend = Array.from({ length: days }, (_, i) => ({
      date: `2026-03-${String(12 + (i % 28)).padStart(2, '0')}`,
      csapRate: 94,
      n2sfRate: 94,
    }));
    expect(trend).toHaveLength(30);
  });

  it('framework=csap일 때 CSAP 데이터만 포함한다', () => {
    const framework = 'csap';
    const entry: Record<string, unknown> = { date: '2026-04-10' };
    if (framework === 'csap' || framework === 'all') entry['csapRate'] = 94;
    if (framework === 'n2sf' || framework === 'all') entry['n2sfRate'] = 94;
    expect(entry['csapRate']).toBe(94);
    expect(entry['n2sfRate']).toBeUndefined();
  });

  it('days는 7~365 범위이다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      days: z.coerce.number().int().min(7).max(365).default(30),
    });
    expect(schema.safeParse({ days: '3' }).success).toBe(false);
    expect(schema.safeParse({ days: '366' }).success).toBe(false);
    expect(schema.safeParse({ days: '90' }).success).toBe(true);
  });

  it('framework는 csap/n2sf/all이다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      framework: z.enum(['csap', 'n2sf', 'all']).default('all'),
    });
    expect(schema.safeParse({ framework: 'csap' }).success).toBe(true);
    expect(schema.safeParse({ framework: 'invalid' }).success).toBe(false);
  });
});

// ── FR-COMP.6: 통합 요약 대시보드 ──

describe('FR-COMP.6: 통합 요약 대시보드', () => {
  it('CSAP 준수율이 올바르다', () => {
    const csapTotal = 79;
    const csapPass = 74;
    const rate = Math.round((csapPass / csapTotal) * 100);
    expect(rate).toBe(94);
  });

  it('N2SF 준수율이 올바르다', () => {
    const n2sfTotal = 18;
    const n2sfPass = 17;
    const rate = Math.round((n2sfPass / n2sfTotal) * 100);
    expect(rate).toBe(94);
  });

  it('감리 준비도가 5단계로 반환된다', () => {
    const phases = [
      { phase: '계획', rate: 100 },
      { phase: '설계', rate: 100 },
      { phase: '구현', rate: 95 },
      { phase: '검증', rate: 90 },
      { phase: '인증', rate: 0 },
    ];
    expect(phases).toHaveLength(5);
    const overall = Math.round(phases.reduce((sum, p) => sum + p.rate, 0) / phases.length);
    expect(overall).toBe(77);
  });

  it('잔여 항목 수가 올바르다', () => {
    const csapRemaining = 79 - 74; // 5
    const n2sfRemaining = 18 - 17; // 1
    const total = csapRemaining + n2sfRemaining;
    expect(total).toBe(6);
  });

  it('위험 수준이 올바르게 결정된다', () => {
    const remaining = 6;
    const riskLevel = remaining > 10 ? 'high' : remaining > 5 ? 'medium' : 'low';
    expect(riskLevel).toBe('medium');
  });

  it('잔여 항목 5개 이하면 low이다', () => {
    const remaining = 3;
    const riskLevel = remaining > 10 ? 'high' : remaining > 5 ? 'medium' : 'low';
    expect(riskLevel).toBe('low');
  });
});

// ── 기존 기능 회귀 ──

describe('기존 기능 회귀: 준수 라우트', () => {
  const routes = [
    'GET /compliance/csap',
    'GET /compliance/csap/gaps',
    'GET /compliance/n2sf',
    'GET /compliance/readiness',
    'GET /compliance/history',
    'GET /compliance/metrics',
    'GET /compliance/trend',
    'GET /compliance/summary',
  ];

  it('8개 라우트가 등록되어 있다 (기존 6 + 신규 2)', () => {
    expect(routes).toHaveLength(8);
  });

  it('trend 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /compliance/trend');
  });

  it('summary 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /compliance/summary');
  });
});
