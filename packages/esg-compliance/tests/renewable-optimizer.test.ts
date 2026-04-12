/**
 * 재생E 최적화 테스트
 * Plan SC: FR-RE.1~5
 */

import {
  GenerationForecaster,
  LoadShiftOptimizer,
  RecSimulator,
} from '../src/renewable-optimizer';

describe('GenerationForecaster', () => {
  it('맑은 날 일사량 100% 시 태양광 출력 ≈ 정격', () => {
    const f = new GenerationForecaster(1000, 500);
    const result = f.forecast24h([
      { hour: 12, solarIrradianceWm2: 1000, windSpeedMs: 0, cloudCoverPercent: 0 },
    ]);
    expect(result[0]?.solarKw).toBeGreaterThan(900);
    expect(result[0]?.windKw).toBe(0);
  });

  it('흐린 날 cloudCover 100% 시 태양광 절반 감쇄', () => {
    const f = new GenerationForecaster(1000, 0);
    const result = f.forecast24h([
      { hour: 12, solarIrradianceWm2: 1000, windSpeedMs: 0, cloudCoverPercent: 100 },
    ]);
    expect(result[0]?.solarKw).toBeLessThanOrEqual(500);
  });

  it('풍속 12-25 m/s 정격 풍력 출력', () => {
    const f = new GenerationForecaster(0, 500);
    const result = f.forecast24h([
      { hour: 1, solarIrradianceWm2: 0, windSpeedMs: 15, cloudCoverPercent: 0 },
    ]);
    expect(result[0]?.windKw).toBe(500);
  });

  it('풍속 0 시 풍력 0', () => {
    const f = new GenerationForecaster(0, 500);
    const result = f.forecast24h([
      { hour: 1, solarIrradianceWm2: 0, windSpeedMs: 1, cloudCoverPercent: 0 },
    ]);
    expect(result[0]?.windKw).toBe(0);
  });

  it('cut-in 3 ~ 12m/s 선형 보간', () => {
    const f = new GenerationForecaster(0, 900);
    const result = f.forecast24h([
      { hour: 1, solarIrradianceWm2: 0, windSpeedMs: 7.5, cloudCoverPercent: 0 },
    ]);
    expect(result[0]?.windKw).toBeGreaterThan(0);
    expect(result[0]?.windKw).toBeLessThan(900);
  });
});

describe('LoadShiftOptimizer', () => {
  it('재생E 풍부 시간대로 유연 부하 이동', () => {
    const opt = new LoadShiftOptimizer();
    const forecast = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      solarKw: h >= 10 && h <= 15 ? 1000 : 0,
      windKw: 0,
      totalKw: h >= 10 && h <= 15 ? 1000 : 0,
    }));
    const loads = [
      { hour: 2, demandKw: 100, flexible: true },
      { hour: 3, demandKw: 100, flexible: true },
      { hour: 14, demandKw: 100, flexible: false }, // 이미 좋은 시간대
    ];
    const result = opt.optimize(forecast, loads);
    expect(result.shiftCount).toBeGreaterThanOrEqual(2);
    expect(result.shiftedLoads.length).toBe(3);
  });

  it('빈 입력 시 0% 비율', () => {
    const opt = new LoadShiftOptimizer();
    const result = opt.optimize([], []);
    expect(result.renewableRatioPercent).toBe(0);
    expect(result.shiftCount).toBe(0);
  });

  it('비유연 부하는 이동 안 함', () => {
    const opt = new LoadShiftOptimizer();
    const forecast = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      solarKw: 0,
      windKw: 0,
      totalKw: 100,
    }));
    const loads = [{ hour: 0, demandKw: 50, flexible: false }];
    const result = opt.optimize(forecast, loads);
    expect(result.shiftedLoads[0]?.hour).toBe(0);
    expect(result.shiftCount).toBe(0);
  });
});

describe('RecSimulator', () => {
  it('잉여 발전량 → REC 매출 추정', () => {
    const sim = new RecSimulator();
    const surplus = [
      { hour: 12, solarKw: 1000, windKw: 0, totalKw: 1000 },
      { hour: 13, solarKw: 1000, windKw: 0, totalKw: 1000 },
    ];
    const result = sim.simulate(surplus, 70000);
    expect(result.mwh).toBeCloseTo(2);
    expect(result.revenueKrw).toBeCloseTo(140000);
  });

  it('빈 입력 시 0', () => {
    const sim = new RecSimulator();
    const result = sim.simulate([], 70000);
    expect(result.mwh).toBe(0);
    expect(result.revenueKrw).toBe(0);
  });
});
