import { describe, it, expect, beforeEach } from 'vitest';
import { GovEnergyEfficiencyAI } from '../gov-energy-efficiency-ai';

describe('GovEnergyEfficiencyAI', () => {
  let svc: GovEnergyEfficiencyAI;

  beforeEach(() => {
    svc = new GovEnergyEfficiencyAI();
  });

  const sampleHigh = {
    buildingId: 'b1',
    monthYYYYMM: '2026-04',
    electricityKwh: 1200,
    gasNm3: 50,
    heatingMcal: 200,
    occupancyAvg: 80,
    floorAreaM2: 5000,
  };

  const sampleLow = {
    buildingId: 'b2',
    monthYYYYMM: '2026-04',
    electricityKwh: 50000,
    gasNm3: 1000,
    heatingMcal: 5000,
    occupancyAvg: 20,
    floorAreaM2: 1000,
  };

  it('데이터를 기록한다', () => {
    svc.recordReading(sampleHigh);
    expect(svc.getAuditLog().some(e => e.action === 'RECORD_READING')).toBe(true);
  });

  it('효율 점수를 계산한다 (높은 효율)', () => {
    svc.recordReading(sampleHigh);
    const result = svc.computeEfficiency('b1', '2026-04');
    expect(result.efficiencyScore).toBeGreaterThan(60);
    expect(['A', 'B']).toContain(result.grade);
  });

  it('낮은 효율은 E등급', () => {
    svc.recordReading(sampleLow);
    const result = svc.computeEfficiency('b2', '2026-04');
    expect(result.grade).toBe('E');
  });

  it('절감 권장사항을 제시한다', () => {
    svc.recordReading(sampleLow);
    const recs = svc.recommendSavings('b2', '2026-04');
    expect(recs.length).toBeGreaterThan(0);
  });

  it('포트폴리오 평균을 계산한다', () => {
    svc.recordReading(sampleHigh);
    svc.recordReading(sampleLow);
    const avg = svc.computePortfolioAverage('2026-04');
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(avg).toBeLessThanOrEqual(100);
  });

  it('S등급 데이터를 차단한다', () => {
    expect(() => svc.recordReading(sampleHigh, 'S')).toThrow('BLOCKED');
  });
});
