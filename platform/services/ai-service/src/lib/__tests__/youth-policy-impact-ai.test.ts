import { describe, it, expect, beforeEach } from 'vitest';
import { YouthPolicyImpactAI } from '../youth-policy-impact-ai';

describe('YouthPolicyImpactAI', () => {
  let ai: YouthPolicyImpactAI;

  beforeEach(() => {
    ai = new YouthPolicyImpactAI();
  });

  it('정책을 등록한다', () => {
    ai.registerPolicy({
      policyId: 'p1',
      title: '청년 취업 지원',
      domain: 'employment',
      targetAgeMin: 19,
      targetAgeMax: 34,
      budgetKRW: 100_000_000,
    });
    expect(ai.listPolicies().length).toBe(1);
  });

  it('결과 데이터를 기록한다', () => {
    ai.registerPolicy({
      policyId: 'p1',
      title: '청년 취업',
      domain: 'employment',
      targetAgeMin: 19,
      targetAgeMax: 34,
      budgetKRW: 50_000_000,
    });
    ai.recordOutcome({
      policyId: 'p1',
      participantCount: 500,
      satisfactionScore: 85,
      beforeIndicator: 60,
      afterIndicator: 80,
    });
    expect(ai.getOutcome('p1')?.participantCount).toBe(500);
  });

  it('정책 영향도를 평가한다', () => {
    ai.registerPolicy({
      policyId: 'p1',
      title: '청년 멘토링',
      domain: 'education',
      targetAgeMin: 15,
      targetAgeMax: 24,
      budgetKRW: 20_000_000,
    });
    ai.recordOutcome({
      policyId: 'p1',
      participantCount: 100,
      satisfactionScore: 90,
      beforeIndicator: 50,
      afterIndicator: 80,
    });
    const result = ai.evaluate('p1');
    expect(result.impactScore).toBeGreaterThan(0);
    expect(['A', 'B', 'C', 'D']).toContain(result.grade);
    expect(result.costPerParticipant).toBe(200_000);
  });

  it('잘못된 연령 범위는 거부한다', () => {
    expect(() =>
      ai.registerPolicy({
        policyId: 'p1',
        title: '잘못된',
        domain: 'welfare',
        targetAgeMin: 40,
        targetAgeMax: 50,
        budgetKRW: 1,
      }),
    ).toThrow('연령');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerPolicy(
        {
          policyId: 'p1',
          title: 'X',
          domain: 'mental_health',
          targetAgeMin: 19,
          targetAgeMax: 24,
          budgetKRW: 1000,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });

  it('도메인별 정책을 필터링한다', () => {
    ai.registerPolicy({
      policyId: 'p1',
      title: 'A',
      domain: 'culture',
      targetAgeMin: 19,
      targetAgeMax: 29,
      budgetKRW: 1,
    });
    ai.registerPolicy({
      policyId: 'p2',
      title: 'B',
      domain: 'welfare',
      targetAgeMin: 19,
      targetAgeMax: 29,
      budgetKRW: 1,
    });
    expect(ai.listPolicies('culture').length).toBe(1);
  });
});
