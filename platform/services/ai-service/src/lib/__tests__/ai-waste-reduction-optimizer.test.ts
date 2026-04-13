import { describe, it, expect, beforeEach } from 'vitest';
import { AIWasteReductionOptimizer } from '../ai-waste-reduction-optimizer';

describe('AIWasteReductionOptimizer', () => {
  let svc: AIWasteReductionOptimizer;

  beforeEach(() => {
    svc = new AIWasteReductionOptimizer();
    svc.recordWaste({ facilityId: 'f1', monthYYYYMM: '2026-04', category: 'food', weightKg: 1000 });
    svc.recordWaste({ facilityId: 'f1', monthYYYYMM: '2026-04', category: 'recyclable', weightKg: 500 });
    svc.recordWaste({ facilityId: 'f2', monthYYYYMM: '2026-04', category: 'general', weightKg: 800 });
  });

  it('데이터를 기록한다', () => {
    expect(svc.getAuditLog().filter(e => e.action === 'RECORD_WASTE').length).toBe(3);
  });

  it('음식물 감축 잠재량 계산', () => {
    const plan = svc.computePlan('f1', '2026-04', 'food');
    expect(plan.reductionPotentialKg).toBe(400);
    expect(plan.targetKg).toBe(600);
  });

  it('재활용 카테고리 권장사항 포함', () => {
    const plan = svc.computePlan('f1', '2026-04', 'recyclable');
    expect(plan.recommendation).toContain('재활용');
  });

  it('시설 총합 계산', () => {
    expect(svc.computeFacilityTotal('f1', '2026-04')).toBe(1500);
  });

  it('시설 순위', () => {
    const ranks = svc.rankFacilities('2026-04');
    expect(ranks[0]?.facilityId).toBe('f1');
    expect(ranks[0]?.totalKg).toBe(1500);
  });

  it('C등급 데이터 차단', () => {
    expect(() => svc.recordWaste({ facilityId: 'f3', monthYYYYMM: '2026-04', category: 'general', weightKg: 100 }, 'C')).toThrow('BLOCKED');
  });
});
