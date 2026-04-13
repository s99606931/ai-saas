import { describe, it, expect, beforeEach } from 'vitest';
import { PublicArtFundingEvaluator, type GrantApplication } from '../public-art-funding-evaluator-ai';

const sampleApp = (id: string, overrides: Partial<GrantApplication> = {}): GrantApplication => ({
  applicationId: id,
  genre: 'music',
  requestedAmountKRW: 10_000_000,
  artisticMeritScore: 85,
  publicAccessScore: 80,
  feasibilityScore: 75,
  localImpactScore: 70,
  previousGrantCount: 0,
  ...overrides,
});

describe('PublicArtFundingEvaluator', () => {
  let ai: PublicArtFundingEvaluator;

  beforeEach(() => {
    ai = new PublicArtFundingEvaluator();
  });

  it('신청을 접수한다', () => {
    ai.submit(sampleApp('a1'));
    expect(ai.listApplications().length).toBe(1);
  });

  it('우수 신청에 전액 지원을 승인한다', () => {
    ai.submit(sampleApp('a1', { artisticMeritScore: 95, publicAccessScore: 95, feasibilityScore: 95, localImpactScore: 95 }));
    const result = ai.evaluate('a1');
    expect(result.decision).toBe('full');
    expect(result.awardedAmountKRW).toBe(10_000_000);
  });

  it('저득점 신청을 reject로 판정한다', () => {
    ai.submit(sampleApp('a1', { artisticMeritScore: 30, publicAccessScore: 30, feasibilityScore: 30, localImpactScore: 30 }));
    const result = ai.evaluate('a1');
    expect(result.decision).toBe('reject');
    expect(result.awardedAmountKRW).toBe(0);
  });

  it('예산 한도 내 배분을 수행한다', () => {
    ai.submit(sampleApp('a1', { requestedAmountKRW: 20_000_000 }));
    ai.submit(sampleApp('a2', { requestedAmountKRW: 15_000_000 }));
    const alloc = ai.allocateBudget(25_000_000);
    const total = alloc.reduce((sum, r) => sum + r.awardedAmountKRW, 0);
    expect(total).toBeLessThanOrEqual(25_000_000);
  });

  it('이전 수혜 횟수로 다양성 감점을 반영한다', () => {
    ai.submit(sampleApp('a1', { previousGrantCount: 5 }));
    const result = ai.evaluate('a1');
    expect(result.rationale.some(r => r.includes('다양성'))).toBe(true);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() => ai.submit(sampleApp('a1'), 'S')).toThrow('BLOCKED');
  });
});
