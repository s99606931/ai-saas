/**
 * AI 청소년 복지 최적화 단위 테스트 — SVC-AI-ADV-R487
 * Plan SC: FR-487.1~6
 */

import { describe, it, expect } from 'vitest';
import { AiYouthWelfareOptimizer } from '../ai-youth-welfare-optimizer';
import type { YouthProfile } from '../ai-youth-welfare-optimizer';

const mk = (over: Partial<YouthProfile> = {}): YouthProfile => ({
  youthId: 'Y1',
  ageYears: 17,
  enrolledInSchool: true,
  householdIncomeKrw: 4_000_000,
  hasParents: true,
  mentalHealthScore: 80,
  academicScore: 70,
  riskBehaviors: 0,
  ...over,
});

describe('AiYouthWelfareOptimizer — R487', () => {
  it('FR-487.1: 건강 청소년 GREEN', () => {
    const o = new AiYouthWelfareOptimizer();
    const r = o.optimize(mk());
    expect(r.priorityTier).toBe('GREEN');
  });

  it('FR-487.2: 복합 위험 RED', () => {
    const o = new AiYouthWelfareOptimizer();
    const r = o.optimize(
      mk({
        enrolledInSchool: false,
        hasParents: false,
        householdIncomeKrw: 500_000,
        mentalHealthScore: 20,
        academicScore: 20,
        riskBehaviors: 4,
      }),
    );
    expect(r.priorityTier).toBe('RED');
    expect(r.counselingSessionsPerMonth).toBe(8);
  });

  it('FR-487.3: 학업 저조 tutoring', () => {
    const o = new AiYouthWelfareOptimizer();
    const r = o.optimize(mk({ academicScore: 30 }));
    expect(r.programs).toContain('tutoring');
  });

  it('FR-487.4: 예산 예측', () => {
    const o = new AiYouthWelfareOptimizer();
    const budget = o.budgetForecast([mk(), mk({ youthId: 'Y2', householdIncomeKrw: 500_000, hasParents: false })]);
    expect(budget).toBeGreaterThanOrEqual(0);
  });

  it('FR-487.5: audit 로그', () => {
    const o = new AiYouthWelfareOptimizer();
    o.optimize(mk());
    expect(o.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-487.6: C/S 차단', () => {
    const o = new AiYouthWelfareOptimizer();
    expect(() => o.optimize(mk(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => o.optimize(mk(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
