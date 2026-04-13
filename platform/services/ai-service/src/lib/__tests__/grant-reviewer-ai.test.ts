import { describe, it, expect } from 'vitest';
import { GrantReviewerAI } from '../grant-reviewer-ai.js';

describe('SVC-AI-ADV-R421 GrantReviewerAI', () => {
  const svc = new GrantReviewerAI();
  const rule = { incomeCap: 40000000, minAge: 18, baseAmount: 1000000 };

  it('FR-421.1: 적격 + 권장액 계산', () => {
    const r = svc.review(
      { applicantId: 'a1', income: 20000000, age: 30, familySize: 3, fraudHistory: false },
      rule,
    );
    expect(r.eligible).toBe(true);
    expect(r.recommendedAmount).toBe(500000); // base*(1-0.5)
    expect(r.riskLevel).toBe('LOW');
    expect(r.reasonCode).toBe('OK');
  });

  it('FR-421.1: 소득 초과 → 부적격', () => {
    const r = svc.review(
      { applicantId: 'a2', income: 50000000, age: 30, familySize: 1, fraudHistory: false },
      rule,
    );
    expect(r.eligible).toBe(false);
    expect(r.reasonCode).toBe('INCOME_OVER_CAP');
  });

  it('FR-421.1: 연령 미달 → 부적격', () => {
    const r = svc.review(
      { applicantId: 'a3', income: 10000000, age: 17, familySize: 1, fraudHistory: false },
      rule,
    );
    expect(r.eligible).toBe(false);
    expect(r.reasonCode).toBe('AGE_UNDER_MIN');
  });

  it('FR-421.3: 부정수급 이력 → HIGH 리스크', () => {
    const r = svc.review(
      { applicantId: 'a4', income: 10000000, age: 30, familySize: 2, fraudHistory: true },
      rule,
    );
    expect(r.riskLevel).toBe('HIGH');
  });

  it('FR-421.4: S 등급 차단', () => {
    expect(() =>
      svc.review(
        { applicantId: 'a5', income: 1, age: 30, familySize: 1, fraudHistory: false },
        rule,
        'S',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-421.5: 감사 로그 기록', () => {
    svc.review(
      { applicantId: 'a6', income: 10000000, age: 25, familySize: 2, fraudHistory: false },
      rule,
    );
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
