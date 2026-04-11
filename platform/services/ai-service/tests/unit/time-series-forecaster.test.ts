// SVC-AI-ADV-R36 단위 테스트: 시계열 예측 엔진
// Design Ref: SVC-AI-ADV-R36 DESIGN §1~§3, §5, §6
// Plan SC: FR-ADV36.1~36.3, FR-ADV36.5~36.6
// CSAP: D-06 예측 감사 로그

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  TimeSeriesForecaster,
  getTimeSeriesForecaster,
  resetTimeSeriesForecaster,
} from '../../src/lib/time-series-forecaster.js';
import type { TimeSeriesPoint } from '../../src/lib/time-series-forecaster.js';

// -- 테스트 데이터 생성 ----------------------------------------------------------

function generateData(count: number, base: number = 100, trend: number = 0): TimeSeriesPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(2026, 0, 1 + i).toISOString(),
    value: base + trend * i + Math.sin(i / 7 * Math.PI) * 10,
  }));
}

// -- 전처리 -- Design §1 --------------------------------------------------------

describe('TimeSeriesForecaster 전처리 (FR-ADV36.1)', () => {
  let forecaster: TimeSeriesForecaster;

  beforeEach(() => {
    forecaster = new TimeSeriesForecaster();
  });

  it('빈 데이터는 빈 배열', () => {
    expect(forecaster.preprocess([])).toHaveLength(0);
  });

  it('시간순 정렬한다', () => {
    const data: TimeSeriesPoint[] = [
      { timestamp: '2026-01-03T00:00:00Z', value: 30 },
      { timestamp: '2026-01-01T00:00:00Z', value: 10 },
      { timestamp: '2026-01-02T00:00:00Z', value: 20 },
    ];
    const result = forecaster.preprocess(data);
    expect(result[0]!.value).toBe(10);
    expect(result[1]!.value).toBe(20);
    expect(result[2]!.value).toBe(30);
  });

  it('원본 데이터를 변경하지 않는다', () => {
    const data = generateData(10);
    const original = data.map((d) => ({ ...d }));
    forecaster.preprocess(data);
    expect(data).toEqual(original);
  });
});

// -- SMA 예측 -- Design §2 ----------------------------------------------------

describe('TimeSeriesForecaster SMA (FR-ADV36.2)', () => {
  let forecaster: TimeSeriesForecaster;

  beforeEach(() => {
    forecaster = new TimeSeriesForecaster({ smaWindow: 5 });
  });

  it('지정된 horizon 수만큼 예측을 생성한다', () => {
    const data = generateData(20);
    const results = forecaster.forecastSMA(data, 5);
    expect(results).toHaveLength(5);
  });

  it('예측 결과에 신뢰 구간을 포함한다', () => {
    const data = generateData(20);
    const results = forecaster.forecastSMA(data, 3);
    for (const r of results) {
      expect(r.lowerBound).toBeLessThanOrEqual(r.predicted);
      expect(r.upperBound).toBeGreaterThanOrEqual(r.predicted);
      expect(r.confidence).toBeGreaterThan(0);
    }
  });

  it('미래 타임스탬프를 생성한다', () => {
    const data = generateData(10);
    const lastTime = new Date(data[data.length - 1]!.timestamp).getTime();
    const results = forecaster.forecastSMA(data, 3);
    for (const r of results) {
      expect(new Date(r.timestamp).getTime()).toBeGreaterThan(lastTime);
    }
  });
});

// -- EMA 예측 -- Design §2 ----------------------------------------------------

describe('TimeSeriesForecaster EMA (FR-ADV36.2)', () => {
  let forecaster: TimeSeriesForecaster;

  beforeEach(() => {
    forecaster = new TimeSeriesForecaster({ emaAlpha: 0.3 });
  });

  it('지정된 horizon 수만큼 예측을 생성한다', () => {
    const data = generateData(20);
    const results = forecaster.forecastEMA(data, 5);
    expect(results).toHaveLength(5);
  });

  it('불확실성이 horizon에 따라 증가한다', () => {
    const data = generateData(30);
    const results = forecaster.forecastEMA(data, 10);
    // 신뢰 구간이 점점 넓어짐
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!.upperBound - results[i - 1]!.lowerBound;
      const curr = results[i]!.upperBound - results[i]!.lowerBound;
      expect(curr).toBeGreaterThanOrEqual(prev - 0.001); // 부동소수점 오차 허용
    }
  });
});

// -- 선형 회귀 예측 -- Design §2 ------------------------------------------------

describe('TimeSeriesForecaster Linear (FR-ADV36.2)', () => {
  let forecaster: TimeSeriesForecaster;

  beforeEach(() => {
    forecaster = new TimeSeriesForecaster();
  });

  it('데이터가 2개 미만이면 빈 결과', () => {
    const data: TimeSeriesPoint[] = [{ timestamp: '2026-01-01T00:00:00Z', value: 100 }];
    expect(forecaster.forecastLinear(data, 5)).toHaveLength(0);
  });

  it('상승 추세를 반영한다', () => {
    // 완벽한 상승 추세
    const data = Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(2026, 0, 1 + i).toISOString(),
      value: 100 + i * 10,
    }));
    const results = forecaster.forecastLinear(data, 3);
    expect(results.length).toBe(3);
    // 마지막 데이터 값(290)보다 예측값이 더 커야 함
    expect(results[0]!.predicted).toBeGreaterThan(290);
  });

  it('하락 추세를 반영한다', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(2026, 0, 1 + i).toISOString(),
      value: 200 - i * 5,
    }));
    const results = forecaster.forecastLinear(data, 3);
    expect(results[0]!.predicted).toBeLessThan(110);
  });
});

// -- 계절성 분해 -- Design §3 ---------------------------------------------------

describe('TimeSeriesForecaster 계절성 분해 (FR-ADV36.3)', () => {
  let forecaster: TimeSeriesForecaster;

  beforeEach(() => {
    forecaster = new TimeSeriesForecaster();
  });

  it('추세, 계절성, 잔차를 분해한다', () => {
    const values = Array.from({ length: 30 }, (_, i) =>
      100 + i * 2 + Math.sin(i / 7 * 2 * Math.PI) * 20,
    );
    const result = forecaster.decomposeSeasonal(values, 7);
    expect(result.trend).toHaveLength(values.length);
    expect(result.seasonal).toHaveLength(values.length);
    expect(result.residual).toHaveLength(values.length);
    expect(result.period).toBe(7);
  });

  it('데이터가 부족하면 원본 반환', () => {
    const values = [10, 20, 30];
    const result = forecaster.decomposeSeasonal(values, 7);
    expect(result.trend).toEqual(values);
    expect(result.seasonal.every((s) => s === 0)).toBe(true);
  });
});

// -- 앙상블 예측 -- Design §5 ---------------------------------------------------

describe('TimeSeriesForecaster 앙상블 (FR-ADV36.5)', () => {
  it('앙상블 예측을 생성한다', () => {
    const forecaster = new TimeSeriesForecaster({ enableEnsemble: true });
    const data = generateData(30);
    const results = forecaster.forecastEnsemble(data, 5);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.predicted).toBeDefined();
      expect(r.lowerBound).toBeLessThanOrEqual(r.predicted);
    }
  });
});

// -- 모델 평가 ----------------------------------------------------------------

describe('TimeSeriesForecaster 모델 평가', () => {
  it('데이터가 부족하면 기본 메트릭을 반환한다', () => {
    const forecaster = new TimeSeriesForecaster();
    const metrics = forecaster.evaluateModels(generateData(5));
    expect(metrics).toHaveLength(3);
    expect(metrics.every((m) => m.mape === 10)).toBe(true);
  });

  it('충분한 데이터로 MAPE를 계산한다', () => {
    const forecaster = new TimeSeriesForecaster();
    const data = generateData(30, 100, 1);
    const metrics = forecaster.evaluateModels(data);
    expect(metrics).toHaveLength(3);
    for (const m of metrics) {
      expect(m.mape).toBeGreaterThanOrEqual(0);
      expect(m.model).toBeTruthy();
    }
  });
});

// -- 통합 예측 ----------------------------------------------------------------

describe('TimeSeriesForecaster 통합 예측', () => {
  it('3개 미만 데이터는 빈 결과', () => {
    const forecaster = new TimeSeriesForecaster();
    const data = generateData(2);
    expect(forecaster.forecast(data, 5)).toHaveLength(0);
  });

  it('앙상블 모드로 예측한다', () => {
    const forecaster = new TimeSeriesForecaster({ enableEnsemble: true });
    const data = generateData(30);
    const results = forecaster.forecast(data, 5);
    expect(results.length).toBeGreaterThan(0);
  });

  it('특정 모델을 지정할 수 있다', () => {
    const forecaster = new TimeSeriesForecaster();
    const data = generateData(20);
    const results = forecaster.forecast(data, 3, 'sma');
    expect(results.length).toBe(3);
  });
});

// -- 비용 예측 -- Design §6 ---------------------------------------------------

describe('TimeSeriesForecaster 비용 예측 (FR-ADV36.6)', () => {
  it('월간 비용을 예측한다', () => {
    const forecaster = new TimeSeriesForecaster();
    const monthlyData: TimeSeriesPoint[] = Array.from({ length: 12 }, (_, i) => ({
      timestamp: new Date(2025, i, 1).toISOString(),
      value: 1000 + i * 50 + Math.random() * 100,
    }));
    const forecasts = forecaster.forecastCost(monthlyData, 3);
    expect(forecasts.length).toBeGreaterThan(0);
    for (const f of forecasts) {
      expect(f.predictedCost).toBeGreaterThanOrEqual(0);
      expect(f.lowerBound).toBeGreaterThanOrEqual(0);
      expect(['increasing', 'decreasing', 'stable']).toContain(f.trend);
    }
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('TimeSeriesForecaster 팩토리', () => {
  afterEach(() => {
    resetTimeSeriesForecaster();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const f1 = getTimeSeriesForecaster();
    const f2 = getTimeSeriesForecaster();
    expect(f1).toBe(f2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const f1 = getTimeSeriesForecaster();
    resetTimeSeriesForecaster();
    const f2 = getTimeSeriesForecaster();
    expect(f1).not.toBe(f2);
  });
});
