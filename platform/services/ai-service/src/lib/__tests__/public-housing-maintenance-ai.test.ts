import { describe, it, expect, beforeEach } from 'vitest';
import { PublicHousingMaintenanceAI } from '../public-housing-maintenance-ai';

describe('PublicHousingMaintenanceAI', () => {
  let ai: PublicHousingMaintenanceAI;

  beforeEach(() => {
    ai = new PublicHousingMaintenanceAI();
    ai.registerUnit({ unitId: 'U1', complexName: '행복주택1단지', builtYear: 1990, floorArea: 60, householdCount: 300 });
  });

  it('수명 초과 + 결함 다수 → emergency', () => {
    ai.addRecord({ unitId: 'U1', kind: 'elevator', installedYear: 1995, lastInspection: '2026-04-01', defectCount: 6, complaintCount: 12 });
    const plans = ai.plan(2026);
    expect(plans[0]?.priority).toBe('emergency');
  });

  it('정상 설비는 monitor', () => {
    ai.addRecord({ unitId: 'U1', kind: 'wall', installedYear: 2020, lastInspection: '2026-04-01', defectCount: 0, complaintCount: 0 });
    const plans = ai.plan(2026);
    expect(plans[0]?.priority).toBe('monitor');
  });

  it('세대수 많을수록 비용 증가', () => {
    ai.addRecord({ unitId: 'U1', kind: 'roof', installedYear: 2000, lastInspection: '2026-04-01', defectCount: 1, complaintCount: 2 });
    const plans = ai.plan(2026);
    expect(plans[0]?.estimatedCost).toBeGreaterThan(30_000_000);
  });

  it('엘리베이터 결함 시 안전 가중', () => {
    ai.addRecord({ unitId: 'U1', kind: 'elevator', installedYear: 2015, lastInspection: '2026-04-01', defectCount: 4, complaintCount: 2 });
    const plans = ai.plan(2026);
    expect(plans[0]?.reason).toContain('승강기');
  });

  it('존재하지 않는 유닛 기록은 무시', () => {
    ai.addRecord({ unitId: 'X', kind: 'plumbing', installedYear: 2000, lastInspection: '2026-04-01', defectCount: 1, complaintCount: 1 });
    const plans = ai.plan(2026);
    expect(plans.length).toBe(0);
  });

  it('음수 결함 입력 오류', () => {
    expect(() =>
      ai.addRecord({ unitId: 'U1', kind: 'heating', installedYear: 2000, lastInspection: '', defectCount: -1, complaintCount: 0 }),
    ).toThrow();
  });
});
