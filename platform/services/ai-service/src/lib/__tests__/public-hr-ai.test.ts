import { describe, it, expect } from 'vitest';
import { PublicHRAI, type EmployeeProfile, type KPIScore, type Feedback360 } from '../public-hr-ai';

describe('PublicHRAI', () => {
  const ai = new PublicHRAI();
  const profiles: EmployeeProfile[] = [
    { employeeId: 'E1', department: 'IT', position: '주무관', yearsOfService: 5, gender: 'M' },
    { employeeId: 'E2', department: 'IT', position: '주무관', yearsOfService: 6, gender: 'F' },
    { employeeId: 'E3', department: 'HR', position: '사무관', yearsOfService: 10, gender: 'F' },
  ];

  it('evaluates performance', () => {
    const kpi: KPIScore = {
      employeeId: 'E1',
      period: '2026-Q1',
      kpi: { delivery: 90, quality: 85 },
      weights: { delivery: 0.6, quality: 0.4 },
    };
    const feedbacks: Feedback360[] = [
      { employeeId: 'E1', role: 'peer', scores: { teamwork: 90 } },
      { employeeId: 'E1', role: 'supervisor', scores: { leadership: 80 } },
    ];
    const r = ai.evaluatePerformance(kpi, feedbacks);
    expect(r.finalScore).toBeGreaterThan(0);
    expect(['S', 'A', 'B', 'C', 'D']).toContain(r.grade);
  });

  it('detects gender bias', () => {
    const results = [
      { employeeId: 'E1', kpiTotal: 90, feedbackTotal: 90, finalScore: 95, grade: 'S' as const },
      { employeeId: 'E2', kpiTotal: 70, feedbackTotal: 70, finalScore: 70, grade: 'C' as const },
      { employeeId: 'E3', kpiTotal: 70, feedbackTotal: 70, finalScore: 70, grade: 'C' as const },
    ];
    const bias = ai.detectBias(results, profiles, 'gender');
    expect(bias.biasSuspected).toBe(true);
    expect(bias.maxGap).toBeGreaterThan(10);
  });

  it('selects promotion candidates', () => {
    const results = [
      { employeeId: 'E1', kpiTotal: 90, feedbackTotal: 90, finalScore: 92, grade: 'A' as const },
      { employeeId: 'E2', kpiTotal: 70, feedbackTotal: 70, finalScore: 70, grade: 'C' as const },
    ];
    const candidates = ai.selectPromotionCandidates(results, profiles);
    expect(candidates).toContain('E1');
    expect(candidates).not.toContain('E2');
  });

  it('suggests development', () => {
    const r = { employeeId: 'E1', kpiTotal: 60, feedbackTotal: 60, finalScore: 60, grade: 'D' as const };
    const s = ai.suggestDevelopment(r, ['의사소통']);
    expect(s.length).toBeGreaterThan(0);
    expect(s.some((x) => x.includes('의사소통'))).toBe(true);
  });

  it('masks PII', () => {
    const masked = ai.maskProfile(profiles[0]!);
    expect(masked.employeeId).toMatch(/^H-/);
    expect(masked.employeeId).not.toBe('E1');
  });
});
