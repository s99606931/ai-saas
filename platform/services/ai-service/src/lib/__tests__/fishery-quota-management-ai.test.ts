import { describe, it, expect, beforeEach } from 'vitest';
import { FisheryQuotaManagementAI } from '../fishery-quota-management-ai';

describe('FisheryQuotaManagementAI', () => {
  let ai: FisheryQuotaManagementAI;

  beforeEach(() => {
    ai = new FisheryQuotaManagementAI();
  });

  it('쿼터를 설정한다', () => {
    ai.setQuota('고등어', 10_000);
    expect(ai.status('고등어').remainingTons).toBe(10_000);
  });

  it('어획량을 기록한다', () => {
    ai.setQuota('오징어', 5_000);
    ai.recordCatch({ vesselId: 'v1', species: '오징어', catchTons: 200, date: '2026-04-01' });
    expect(ai.status('오징어').remainingTons).toBe(4_800);
  });

  it('이용률을 계산한다', () => {
    ai.setQuota('멸치', 1_000);
    ai.recordCatch({ vesselId: 'v1', species: '멸치', catchTons: 500, date: '2026-04-01' });
    expect(ai.status('멸치').utilizationPct).toBe(50);
  });

  it('남획을 탐지한다', () => {
    ai.setQuota('명태', 100);
    ai.recordCatch({ vesselId: 'v1', species: '명태', catchTons: 150, date: '2026-04-01' });
    expect(ai.listOverfished()).toContain('명태');
  });

  it('선박별 총 어획량을 집계한다', () => {
    ai.setQuota('삼치', 10_000);
    ai.recordCatch({ vesselId: 'v1', species: '삼치', catchTons: 100, date: '2026-04-01' });
    ai.recordCatch({ vesselId: 'v1', species: '삼치', catchTons: 50, date: '2026-04-02' });
    expect(ai.totalCatchByVessel('v1')).toBe(150);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() => ai.setQuota('광어', 100, 'S')).toThrow('BLOCKED');
  });
});
