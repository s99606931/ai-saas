// Test Ref: MTU-N453 §renewable-optimizer
// Plan SC: FR-RE.1 ~ FR-RE.5
import { describe, it, expect } from 'vitest';
import {
  ProductionForecaster,
  LoadAnalyzer,
  LoadShifter,
  RecSimulator,
  renewableRatio,
  type HourlyReading,
} from '../src/index.js';

function makeHours(fn: (h: number) => number): HourlyReading[] {
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, kwh: fn(h) }));
}

describe('ProductionForecaster — FR-RE.1', () => {
  it('solar 예측은 야간에 0', () => {
    const f = new ProductionForecaster();
    const hist = makeHours((h) => (h > 6 && h < 18 ? 50 : 0));
    const forecast = f.forecastSolar(hist, 100);
    expect(forecast.hours.length).toBe(24);
    expect(forecast.hours[0].kwh).toBeLessThanOrEqual(forecast.hours[12].kwh);
    expect(forecast.hours[2].kwh).toBeLessThan(forecast.hours[12].kwh);
    expect(forecast.mapeEstimate).toBeLessThanOrEqual(0.1);
  });

  it('wind 예측은 평균 회귀 + 야간 가중', () => {
    const f = new ProductionForecaster();
    const hist = makeHours(() => 30);
    const forecast = f.forecastWind(hist, 100);
    expect(forecast.source).toBe('wind');
    expect(forecast.hours[0].kwh).toBeGreaterThan(forecast.hours[10].kwh);
  });

  it('24시간 미만 입력 에러', () => {
    const f = new ProductionForecaster();
    expect(() => f.forecastSolar([{ hour: 0, kwh: 1 }], 100)).toThrow();
  });
});

describe('LoadAnalyzer — FR-RE.2', () => {
  it('피크/베이스 시간 감지', () => {
    const analyzer = new LoadAnalyzer();
    const load = makeHours((h) => (h === 14 ? 100 : h === 3 ? 5 : 40));
    const r = analyzer.analyze({ hours: load });
    expect(r.peakHour).toBe(14);
    expect(r.baseHour).toBe(3);
    expect(r.total).toBeGreaterThan(0);
  });
});

describe('LoadShifter — FR-RE.3', () => {
  it('잉여 시간 → 부족 시간 부하 이동 추천', () => {
    const f = new ProductionForecaster();
    const solarHist = makeHours((h) => (h === 12 ? 80 : 0));
    const solarForecast = f.forecastSolar(solarHist, 100);
    const load = { hours: makeHours((h) => (h === 20 ? 60 : 10)) };
    const shifter = new LoadShifter();
    const recs = shifter.recommend(load, solarForecast, 30);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].kwhShift).toBeGreaterThan(0);
  });
});

describe('RecSimulator — FR-RE.4', () => {
  it('잉여 kWh 기반 수익 추정', () => {
    const f = new ProductionForecaster();
    const solarHist = makeHours((h) => (h > 6 && h < 18 ? 80 : 0));
    const forecast = f.forecastSolar(solarHist, 100);
    const load = { hours: makeHours(() => 10) };
    const sim = new RecSimulator(70);
    const trade = sim.simulate(forecast, load);
    expect(trade.surplusKwh).toBeGreaterThan(0);
    expect(trade.estimatedRevenueKrw).toBeGreaterThan(0);
  });
});

describe('renewableRatio — FR-RE.5', () => {
  it('기본 비율 계산', () => {
    expect(renewableRatio(30, 100)).toBe(0.3);
  });

  it('재생E > 총량인 경우 1로 클램프', () => {
    expect(renewableRatio(120, 100)).toBe(1);
  });

  it('음수 분모 방어', () => {
    expect(renewableRatio(10, 0)).toBe(0);
  });
});
