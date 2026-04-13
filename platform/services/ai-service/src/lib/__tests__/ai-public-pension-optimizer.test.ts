import { describe, it, expect, beforeEach } from 'vitest';
import { AIPublicPensionOptimizer } from '../ai-public-pension-optimizer';

describe('AIPublicPensionOptimizer', () => {
  let ai: AIPublicPensionOptimizer;

  beforeEach(() => {
    ai = new AIPublicPensionOptimizer();
  });

  it('정상 프로필 최적화 결과를 반환한다', () => {
    const r = ai.optimize({
      subscriberId: 'S1',
      currentAge: 55,
      expectedRetirementAge: 65,
      monthlyContributionKrw: 300000,
      yearsContributed: 25,
      expectedLongevity: 85,
    });
    expect(r.scenarios).toHaveLength(5);
    expect([60, 63, 65, 67, 70]).toContain(r.recommendedStartAge);
  });

  it('조기 수령 시나리오는 월 지급액이 감소한다', () => {
    const r = ai.optimize({
      subscriberId: 'S2',
      currentAge: 55,
      expectedRetirementAge: 65,
      monthlyContributionKrw: 400000,
      yearsContributed: 30,
      expectedLongevity: 85,
    });
    const early = r.scenarios.find((s) => s.startAge === 60)!;
    const normal = r.scenarios.find((s) => s.startAge === 65)!;
    expect(early.monthlyPayoutKrw).toBeLessThan(normal.monthlyPayoutKrw);
  });

  it('연기 수령 시나리오는 월 지급액이 증가한다', () => {
    const r = ai.optimize({
      subscriberId: 'S3',
      currentAge: 60,
      expectedRetirementAge: 65,
      monthlyContributionKrw: 500000,
      yearsContributed: 35,
      expectedLongevity: 88,
    });
    const normal = r.scenarios.find((s) => s.startAge === 65)!;
    const late = r.scenarios.find((s) => s.startAge === 70)!;
    expect(late.monthlyPayoutKrw).toBeGreaterThan(normal.monthlyPayoutKrw);
  });

  it('기대수명이 현재 연령보다 낮으면 오류', () => {
    expect(() =>
      ai.optimize({
        subscriberId: 'S4',
        currentAge: 90,
        expectedRetirementAge: 65,
        monthlyContributionKrw: 1,
        yearsContributed: 10,
        expectedLongevity: 80,
      }),
    ).toThrow();
  });

  it('음수 연령 또는 납입기간 시 오류', () => {
    expect(() =>
      ai.optimize({
        subscriberId: 'S5',
        currentAge: -1,
        expectedRetirementAge: 65,
        monthlyContributionKrw: 100000,
        yearsContributed: 10,
        expectedLongevity: 80,
      }),
    ).toThrow();
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.optimize(
        {
          subscriberId: 'S6',
          currentAge: 55,
          expectedRetirementAge: 65,
          monthlyContributionKrw: 100000,
          yearsContributed: 10,
          expectedLongevity: 80,
        },
        'C' as never,
      ),
    ).toThrow('BLOCKED');
  });
});
