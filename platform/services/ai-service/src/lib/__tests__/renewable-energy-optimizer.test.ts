import { describe, it, expect } from 'vitest';
import { RenewableEnergyOptimizer, type ConsumptionPoint } from '../renewable-energy-optimizer';

describe('RenewableEnergyOptimizer', () => {
  const svc = new RenewableEnergyOptimizer();

  it('FR-RE.1 24시간 생산량 예측', () => {
    const gen = svc.forecastGeneration(100, 30);
    expect(gen.length).toBe(24);
    expect(gen[12]!.solarKwh).toBeGreaterThan(0);
    expect(gen[0]!.solarKwh).toBe(0);
  });

  it('FR-RE.2 부하 분석', () => {
    const consumption: ConsumptionPoint[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      loadKwh: h === 14 ? 200 : 50,
      shiftable: h === 14,
    }));
    const r = svc.analyzeConsumption(consumption);
    expect(r.peak.hour).toBe(14);
    expect(r.shiftableTotal).toBe(200);
  });

  it('FR-RE.3 부하 이동 추천', () => {
    const gen = svc.forecastGeneration(100, 30);
    const consumption: ConsumptionPoint[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      loadKwh: h === 2 ? 300 : 20,
      shiftable: h === 2,
    }));
    const recs = svc.recommendShifts(gen, consumption);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.fromHour).toBe(2);
  });

  it('FR-RE.4 REC 거래', () => {
    const r = svc.simulateRecTrade(1000, 50);
    expect(r.revenue).toBe(50000);
  });

  it('FR-RE.5 재생E 비율', () => {
    const gen = svc.forecastGeneration(100, 30);
    const consumption: ConsumptionPoint[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, loadKwh: 50, shiftable: false }));
    const snaps = svc.calculateRatios(gen, consumption);
    expect(snaps.length).toBe(24);
    expect(snaps[12]!.ratio).toBeGreaterThan(0);
  });
});
