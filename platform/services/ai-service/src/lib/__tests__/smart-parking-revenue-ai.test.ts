import { describe, it, expect, beforeEach } from 'vitest';
import { SmartParkingRevenueAI, type ParkingLot } from '../smart-parking-revenue-ai';

const lot = (over: Partial<ParkingLot> = {}): ParkingLot => ({
  lotId: 'p1',
  capacity: 100,
  baseRatePerHour: 1000,
  currentOccupancy: 50,
  peakHours: [8, 9, 18, 19],
  ...over,
});

describe('SmartParkingRevenueAI', () => {
  let ai: SmartParkingRevenueAI;

  beforeEach(() => {
    ai = new SmartParkingRevenueAI();
  });

  it('피크 시간 할증 적용', () => {
    ai.registerLot(lot());
    const r = ai.computeDynamicRate('p1', 8);
    expect(r.rate).toBeGreaterThan(1000);
    expect(r.reason).toContain('피크');
  });

  it('저점유 시간대 할인', () => {
    ai.registerLot(lot({ currentOccupancy: 20 }));
    const r = ai.computeDynamicRate('p1', 3);
    expect(r.rate).toBeLessThan(1000);
  });

  it('포화 임박 시 추가 할증', () => {
    ai.registerLot(lot({ currentOccupancy: 95 }));
    const r = ai.computeDynamicRate('p1', 14);
    expect(r.reason).toContain('포화');
  });

  it('수익 예측', () => {
    ai.registerLot(lot());
    const report = ai.forecastRevenue('p1', [8, 9, 10]);
    expect(report.totalRevenue).toBeGreaterThan(0);
    expect(report.peakRevenue).toBeGreaterThan(0);
  });

  it('점유 업데이트 검증', () => {
    ai.registerLot(lot());
    expect(() => ai.updateOccupancy('p1', 200)).toThrow();
  });

  it('C등급 차단', () => {
    expect(() => ai.registerLot(lot(), 'C')).toThrow('BLOCKED');
  });
});
