import { describe, it, expect, beforeEach } from 'vitest';
import { GovernmentLeaseContractAI, type LeaseContract } from '../government-lease-contract-ai';

const sampleContract = (id: string, overrides: Partial<LeaseContract> = {}): LeaseContract => ({
  contractId: id,
  propertyType: 'office',
  areaM2: 100,
  monthlyRentKRW: 3_000_000,
  depositKRW: 30_000_000,
  termMonths: 24,
  marketRentPerM2: 30_000,
  ...overrides,
});

describe('GovernmentLeaseContractAI', () => {
  let ai: GovernmentLeaseContractAI;

  beforeEach(() => {
    ai = new GovernmentLeaseContractAI();
  });

  it('계약을 등록한다', () => {
    ai.registerContract(sampleContract('c1'));
    expect(ai.listContracts().length).toBe(1);
  });

  it('시세에 부합하는 계약을 approve로 판정한다', () => {
    ai.registerContract(sampleContract('c1'));
    const review = ai.review('c1');
    expect(review.verdict).toBe('approve');
    expect(review.riskLevel).toBe('low');
  });

  it('시세 과다 초과 계약을 reject로 판정한다', () => {
    ai.registerContract(sampleContract('c1', { monthlyRentKRW: 10_000_000 }));
    const review = ai.review('c1');
    expect(review.verdict).toBe('reject');
    expect(review.riskLevel).toBe('high');
  });

  it('연간 총 임대료를 합산한다', () => {
    ai.registerContract(sampleContract('c1', { monthlyRentKRW: 1_000_000 }));
    ai.registerContract(sampleContract('c2', { monthlyRentKRW: 2_000_000 }));
    expect(ai.totalAnnualCost()).toBe(36_000_000);
  });

  it('잘못된 면적은 거부한다', () => {
    expect(() => ai.registerContract(sampleContract('c1', { areaM2: -1 }))).toThrow('면적');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() => ai.registerContract(sampleContract('c1'), 'S')).toThrow('BLOCKED');
  });
});
