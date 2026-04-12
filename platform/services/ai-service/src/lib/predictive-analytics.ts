// Design Ref: MTU-N472 §예측 분석 SaaS
// Plan SC: FR-PA.1~5

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface Decomposition {
  trend: number[];
  seasonal: number[];
  residual: number[];
}

export interface Forecast {
  point: number[];
  lower: number[];
  upper: number[];
  model: 'ARIMA' | 'Prophet' | 'LSTM' | 'Naive';
}

export interface Accuracy {
  mape: number;
  rmse: number;
}

export class PredictiveAnalytics {
  /** FR-PA.1 시계열 분해 */
  decompose(series: TimeSeriesPoint[], period = 7): Decomposition {
    const n = series.length;
    const values = series.map((p) => p.value);
    const trend: number[] = [];
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - Math.floor(period / 2));
      const end = Math.min(n, i + Math.ceil(period / 2));
      const slice = values.slice(start, end);
      trend.push(+(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(3));
    }
    const detrended = values.map((v, i) => v - (trend[i] ?? 0));
    const seasonal: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let count = 0;
      for (let j = i % period; j < n; j += period) {
        sum += detrended[j] ?? 0;
        count++;
      }
      seasonal[i] = +(sum / count).toFixed(3);
    }
    const residual = values.map(
      (v, i) => +(v - (trend[i] ?? 0) - (seasonal[i] ?? 0)).toFixed(3),
    );
    return { trend, seasonal, residual };
  }

  /** FR-PA.2 모델 자동 선택 */
  selectModel(series: TimeSeriesPoint[]): Forecast['model'] {
    const n = series.length;
    if (n < 20) return 'Naive';
    if (n < 100) return 'ARIMA';
    if (n < 1000) return 'Prophet';
    return 'LSTM';
  }

  /** FR-PA.3 예측 (선형 외삽 + 구간) */
  forecast(series: TimeSeriesPoint[], steps: number): Forecast {
    const values = series.map((p) => p.value);
    const n = values.length;
    if (n < 2) {
      const last = values[n - 1] ?? 0;
      return {
        point: new Array(steps).fill(last),
        lower: new Array(steps).fill(last),
        upper: new Array(steps).fill(last),
        model: 'Naive',
      };
    }
    // 선형 회귀 기울기
    const xs = values.map((_, i) => i);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const xi = xs[i] ?? 0;
      const vi = values[i] ?? 0;
      num += (xi - xMean) * (vi - yMean);
      den += (xi - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    const point: number[] = [];
    const residuals = values.map((v, i) => v - (intercept + slope * i));
    const std = Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / n);
    for (let i = 0; i < steps; i++) {
      point.push(+(intercept + slope * (n + i)).toFixed(3));
    }
    const lower = point.map((p) => +(p - 1.96 * std).toFixed(3));
    const upper = point.map((p) => +(p + 1.96 * std).toFixed(3));
    return { point, lower, upper, model: this.selectModel(series) };
  }

  /** FR-PA.4 백테스팅 */
  backtest(series: TimeSeriesPoint[], trainRatio = 0.8): Accuracy {
    const splitIdx = Math.floor(series.length * trainRatio);
    const train = series.slice(0, splitIdx);
    const test = series.slice(splitIdx);
    if (test.length === 0) return { mape: 0, rmse: 0 };
    const fc = this.forecast(train, test.length);
    return this.accuracy(
      test.map((t) => t.value),
      fc.point,
    );
  }

  /** FR-PA.5 정확도 메트릭 */
  accuracy(actual: number[], predicted: number[]): Accuracy {
    const n = actual.length;
    let mape = 0;
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const a = actual[i] ?? 0;
      const p = predicted[i] ?? 0;
      if (a !== 0) mape += Math.abs((a - p) / a);
      sse += (a - p) ** 2;
    }
    return {
      mape: +((mape / n) * 100).toFixed(2),
      rmse: +Math.sqrt(sse / n).toFixed(3),
    };
  }
}

export const predictiveAnalytics = new PredictiveAnalytics();
