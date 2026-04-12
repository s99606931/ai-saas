import { describe, it, expect } from 'vitest';
import { PredictiveAnalytics, type TimeSeriesPoint } from '../predictive-analytics';

describe('PredictiveAnalytics', () => {
  const svc = new PredictiveAnalytics();
  const series: TimeSeriesPoint[] = Array.from({ length: 30 }, (_, i) => ({
    timestamp: `2026-04-${String(i + 1).padStart(2, '0')}`,
    value: 10 + i * 0.5 + Math.sin(i / 3),
  }));

  it('FR-PA.1 분해', () => {
    const d = svc.decompose(series, 7);
    expect(d.trend.length).toBe(30);
    expect(d.seasonal.length).toBe(30);
    expect(d.residual.length).toBe(30);
  });

  it('FR-PA.2 모델 선택', () => {
    expect(svc.selectModel(series)).toBe('ARIMA');
    expect(svc.selectModel(series.slice(0, 10))).toBe('Naive');
  });

  it('FR-PA.3 예측', () => {
    const fc = svc.forecast(series, 5);
    expect(fc.point.length).toBe(5);
    expect(fc.lower.length).toBe(5);
    expect(fc.upper[0]!).toBeGreaterThan(fc.lower[0]!);
  });

  it('FR-PA.4 백테스팅', () => {
    const acc = svc.backtest(series, 0.8);
    expect(acc.mape).toBeGreaterThanOrEqual(0);
  });

  it('FR-PA.5 정확도', () => {
    const acc = svc.accuracy([10, 20, 30], [11, 19, 31]);
    expect(acc.mape).toBeLessThan(10);
  });
});
