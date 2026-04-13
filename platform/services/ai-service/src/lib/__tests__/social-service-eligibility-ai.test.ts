/**
 * 사회 서비스 자격 자동 심사 단위 테스트 — SVC-AI-ADV-R469
 * Plan SC: FR-469.1~5
 */

import { describe, it, expect } from 'vitest';
import { SocialServiceEligibilityAi } from '../social-service-eligibility-ai';

describe('SocialServiceEligibilityAi — R469', () => {
  it('FR-469.3: 노인돌봄 자격 판정', () => {
    const e = new SocialServiceEligibilityAi();
    const r = e.evaluate({ id: 'a1', age: 70, householdSize: 1, monthlyIncome: 500000 });
    expect(r.eligibleServices).toContain('elder-care');
    expect(r.eligibleServices).toContain('basic-livelihood');
  });

  it('FR-469.3: 아동수당 자격 판정', () => {
    const e = new SocialServiceEligibilityAi();
    const r = e.evaluate({ id: 'a2', age: 5, householdSize: 3, monthlyIncome: 2000000 });
    expect(r.eligibleServices).toContain('child-allowance');
  });

  it('FR-469.3: 한부모 가정 자격', () => {
    const e = new SocialServiceEligibilityAi();
    const r = e.evaluate({ id: 'a3', age: 35, householdSize: 2, monthlyIncome: 2500000 });
    expect(r.eligibleServices).toContain('single-parent');
  });

  it('FR-469.4: 부적격 사유 기록', () => {
    const e = new SocialServiceEligibilityAi();
    const r = e.evaluate({ id: 'a4', age: 30, householdSize: 1, monthlyIncome: 5000000 });
    expect(r.reasons['elder-care']).toBeDefined();
    expect(r.reasons['child-allowance']).toBeDefined();
  });

  it('FR-469.1: invalid 거부', () => {
    const e = new SocialServiceEligibilityAi();
    expect(() =>
      e.evaluate({ id: 'x', age: -1, householdSize: 1, monthlyIncome: 0 }),
    ).toThrow();
  });

  it('FR-469.5: C/S 차단 + audit log', () => {
    const e = new SocialServiceEligibilityAi();
    expect(() =>
      e.evaluate({ id: 'x', age: 10, householdSize: 1, monthlyIncome: 0 }, 'S'),
    ).toThrow(/N2SF_BLOCKED/);
    e.evaluate({ id: 'x', age: 10, householdSize: 1, monthlyIncome: 0 });
    expect(e.getAuditLog().length).toBeGreaterThan(0);
  });
});
