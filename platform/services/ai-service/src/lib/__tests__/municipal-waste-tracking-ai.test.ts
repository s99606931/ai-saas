import { describe, it, expect, beforeEach } from 'vitest';
import { MunicipalWasteTrackingAI } from '../municipal-waste-tracking-ai';

describe('MunicipalWasteTrackingAI', () => {
  let ai: MunicipalWasteTrackingAI;

  beforeEach(() => {
    ai = new MunicipalWasteTrackingAI();
  });

  it('통 등록 후 수거 계획 생성', () => {
    ai.registerBin({ binId: 'B1', district: '강남', capacity: 100, wasteType: 'general' });
    ai.report({ binId: 'B1', timestamp: '2026-04-13T10:00:00Z', fillLevel: 0.95, contaminationRate: 0.1 });
    const plans = ai.planCollection();
    expect(plans[0]?.priority).toBe('now');
    expect(plans[0]?.estimatedWeight).toBeGreaterThan(0);
  });

  it('위험물은 즉시 수거', () => {
    ai.registerBin({ binId: 'B2', district: '서초', capacity: 50, wasteType: 'hazardous' });
    ai.report({ binId: 'B2', timestamp: '2026-04-13T10:00:00Z', fillLevel: 0.1, contaminationRate: 0 });
    const plans = ai.planCollection();
    expect(plans[0]?.priority).toBe('now');
  });

  it('오염율 30% 초과 시 contaminated true', () => {
    ai.registerBin({ binId: 'B3', district: '강북', capacity: 80, wasteType: 'recycle' });
    ai.report({ binId: 'B3', timestamp: '2026-04-13T10:00:00Z', fillLevel: 0.6, contaminationRate: 0.4 });
    const plans = ai.planCollection();
    expect(plans.find((p) => p.binId === 'B3')?.contaminated).toBe(true);
  });

  it('구별 통계 산출', () => {
    ai.registerBin({ binId: 'A1', district: '마포', capacity: 100, wasteType: 'general' });
    ai.registerBin({ binId: 'A2', district: '마포', capacity: 100, wasteType: 'recycle' });
    ai.report({ binId: 'A2', timestamp: '2026-04-13T10:00:00Z', fillLevel: 0.5, contaminationRate: 0.2 });
    const stats = ai.statsByDistrict('마포');
    expect(stats.totalBins).toBe(2);
    expect(stats.recycleRate).toBe(0.5);
  });

  it('없는 구 조회 시 0 반환', () => {
    const stats = ai.statsByDistrict('없음');
    expect(stats.totalBins).toBe(0);
  });

  it('fillLevel 범위 초과 오류', () => {
    ai.registerBin({ binId: 'E1', district: 'x', capacity: 10, wasteType: 'food' });
    expect(() => ai.report({ binId: 'E1', timestamp: '2026-04-13T10:00:00Z', fillLevel: 2, contaminationRate: 0 })).toThrow();
  });
});
