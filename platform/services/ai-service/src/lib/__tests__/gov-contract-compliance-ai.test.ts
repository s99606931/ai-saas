import { describe, it, expect, beforeEach } from 'vitest';
import { GovContractComplianceAi, type GovContract } from '../gov-contract-compliance-ai';

describe('GovContractComplianceAi', () => {
  let ai: GovContractComplianceAi;

  beforeEach(() => {
    ai = new GovContractComplianceAi();
  });

  const sample = (over: Partial<GovContract> = {}): GovContract => ({
    contractId: 'c-1',
    type: 'service',
    amountKrw: 50_000_000,
    biddingMethod: 'open',
    competingBidders: 5,
    contractorRegistered: true,
    performanceBondPct: 15,
    hasIntegrityPledge: true,
    ...over,
  });

  it('완벽한 계약은 compliant이다', () => {
    const result = ai.check(sample());
    expect(result.compliant).toBe(true);
    expect(result.recommendation).toBe('approve');
  });

  it('2억 이상 임의계약은 위반이다', () => {
    const result = ai.check(
      sample({ amountKrw: 300_000_000, biddingMethod: 'private' }),
    );
    expect(result.violations).toContain('open_bidding_required');
    expect(result.recommendation).toBe('reject');
  });

  it('미등록 계약자는 violation이다', () => {
    const result = ai.check(sample({ contractorRegistered: false }));
    expect(result.violations).toContain('unregistered_contractor');
  });

  it('낮은 이행보증금은 violation이다', () => {
    const result = ai.check(sample({ performanceBondPct: 5 }));
    expect(result.violations).toContain('insufficient_performance_bond');
  });

  it('일괄 검사가 동작한다', () => {
    const results = ai.batchCheck([sample(), sample({ contractId: 'c-2' })]);
    expect(results.length).toBe(2);
  });

  it('C등급 데이터는 차단된다', () => {
    expect(() => ai.check(sample(), 'C')).toThrow('BLOCKED');
  });
});
