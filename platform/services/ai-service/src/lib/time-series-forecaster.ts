// 시계열 예측 엔진 -- FR-ADV36.1~36.3, FR-ADV36.5~36.6
// Design Ref: SVC-AI-ADV-R36 DESIGN §1~§3, §5, §6
// Plan SC: SC-1 (예측 정확도 MAPE < 15%)
// CSAP: D-06 예측 감사 로그

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 시계열 데이터 포인트 */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

/** 예측 결과 */
export interface ForecastResult {
  timestamp: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

/** 예측 모델 유형 */
export type ForecastModel = 'sma' | 'ema' | 'linear' | 'ensemble';

/** 계절성 분해 결과 -- Design §3 */
export interface SeasonalDecomposition {
  trend: number[];
  seasonal: number[];
  residual: number[];
  period: number;
}

/** 모델 성능 지표 */
export interface ModelMetrics {
  model: ForecastModel;
  mape: number;
  rmse: number;
  mae: number;
}

/** 비용 예측 -- Design §6 */
export interface CostForecast {
  month: string;
  predictedCost: number;
  lowerBound: number;
  upperBound: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/** 예측기 설정 */
export interface ForecasterConfig {
  /** SMA 윈도우 크기 */
  smaWindow: number;
  /** EMA 알파 (평활 계수) */
  emaAlpha: number;
  /** 신뢰 구간 배율 (1.96 = 95%) */
  confidenceMultiplier: number;
  /** 앙상블 활성화 */
  enableEnsemble: boolean;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ForecasterConfig = {
  smaWindow: 7,
  emaAlpha: 0.3,
  confidenceMultiplier: 1.96,
  enableEnsemble: true,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'time-series-forecaster',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- 통계 유틸 ────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg?: number): number {
  if (values.length < 2) return 0;
  const m = avg ?? mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

// -- TimeSeriesForecaster 메인 클래스 ─────────────────────────────────────────

/** 시계열 예측 엔진 -- Design §2 */
export class TimeSeriesForecaster {
  private readonly config: ForecasterConfig;

  constructor(config?: Partial<ForecasterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -- 전처리 -- Design §1 ──────────────────────────────────────────────

  /** 시계열 전처리: 결측치 보간 + 이상치 처리 */
  preprocess(data: TimeSeriesPoint[]): TimeSeriesPoint[] {
    if (data.length === 0) return [];

    // 시간순 정렬
    const sorted = [...data].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // 결측치 선형 보간
    const values = sorted.map((p) => p.value);
    for (let i = 0; i < values.length; i++) {
      if (isNaN(values[i]!) || values[i] === null || values[i] === undefined) {
        const prev = i > 0 ? (values[i - 1] ?? 0) : 0;
        const next = i < values.length - 1 ? (values[i + 1] ?? prev) : prev;
        values[i] = (prev + next) / 2;
      }
    }

    // 윈소라이징 (1%, 99% 클리핑)
    const sortedValues = [...values].sort((a, b) => a - b);
    const p1 = sortedValues[Math.floor(sortedValues.length * 0.01)] ?? sortedValues[0] ?? 0;
    const p99 = sortedValues[Math.floor(sortedValues.length * 0.99)] ?? sortedValues[sortedValues.length - 1] ?? 100;

    return sorted.map((p, i) => ({
      timestamp: p.timestamp,
      value: Math.max(p1, Math.min(p99, values[i] ?? 0)),
    }));
  }

  // -- 단순 이동평균 (SMA) -- Design §2 ─────────────────────────────────

  /** SMA 예측 */
  forecastSMA(data: TimeSeriesPoint[], horizons: number): ForecastResult[] {
    const values = data.map((p) => p.value);
    const window = Math.min(this.config.smaWindow, values.length);
    const recentValues = values.slice(-window);
    const avg = mean(recentValues);
    const sd = stddev(recentValues, avg);

    const lastTime = new Date(data[data.length - 1]?.timestamp ?? Date.now());
    const interval = data.length >= 2
      ? new Date(data[data.length - 1]!.timestamp).getTime() - new Date(data[data.length - 2]!.timestamp).getTime()
      : 3600_000;

    const results: ForecastResult[] = [];
    for (let h = 1; h <= horizons; h++) {
      const futureTime = new Date(lastTime.getTime() + interval * h);
      results.push({
        timestamp: futureTime.toISOString(),
        predicted: avg,
        lowerBound: avg - this.config.confidenceMultiplier * sd,
        upperBound: avg + this.config.confidenceMultiplier * sd,
        confidence: 0.95,
      });
    }

    return results;
  }

  // -- 지수 이동평균 (EMA) -- Design §2 ─────────────────────────────────

  /** EMA 예측 */
  forecastEMA(data: TimeSeriesPoint[], horizons: number): ForecastResult[] {
    const values = data.map((p) => p.value);
    const alpha = this.config.emaAlpha;

    // EMA 계산
    let ema = values[0] ?? 0;
    const emaValues: number[] = [ema];
    for (let i = 1; i < values.length; i++) {
      ema = alpha * (values[i] ?? 0) + (1 - alpha) * ema;
      emaValues.push(ema);
    }

    const residuals = values.map((v, i) => v - (emaValues[i] ?? 0));
    const sd = stddev(residuals);

    const lastTime = new Date(data[data.length - 1]?.timestamp ?? Date.now());
    const interval = data.length >= 2
      ? new Date(data[data.length - 1]!.timestamp).getTime() - new Date(data[data.length - 2]!.timestamp).getTime()
      : 3600_000;

    const results: ForecastResult[] = [];
    for (let h = 1; h <= horizons; h++) {
      const futureTime = new Date(lastTime.getTime() + interval * h);
      results.push({
        timestamp: futureTime.toISOString(),
        predicted: ema,
        lowerBound: ema - this.config.confidenceMultiplier * sd * Math.sqrt(h),
        upperBound: ema + this.config.confidenceMultiplier * sd * Math.sqrt(h),
        confidence: Math.max(0.5, 0.95 - 0.01 * h),
      });
    }

    return results;
  }

  // -- 선형 회귀 추세 -- Design §2 ──────────────────────────────────────

  /** 선형 회귀 예측 */
  forecastLinear(data: TimeSeriesPoint[], horizons: number): ForecastResult[] {
    const values = data.map((p) => p.value);
    const n = values.length;
    if (n < 2) return [];

    // 선형 회귀: y = a + b*x
    const xMean = (n - 1) / 2;
    const yMean = mean(values);

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * ((values[i] ?? 0) - yMean);
      denominator += (i - xMean) ** 2;
    }

    const b = denominator !== 0 ? numerator / denominator : 0;
    const a = yMean - b * xMean;

    // 잔차 표준편차
    const residuals = values.map((v, i) => v - (a + b * i));
    const sd = stddev(residuals);

    const lastTime = new Date(data[data.length - 1]?.timestamp ?? Date.now());
    const interval = data.length >= 2
      ? new Date(data[data.length - 1]!.timestamp).getTime() - new Date(data[data.length - 2]!.timestamp).getTime()
      : 3600_000;

    const results: ForecastResult[] = [];
    for (let h = 1; h <= horizons; h++) {
      const x = n - 1 + h;
      const predicted = a + b * x;
      const futureTime = new Date(lastTime.getTime() + interval * h);

      results.push({
        timestamp: futureTime.toISOString(),
        predicted,
        lowerBound: predicted - this.config.confidenceMultiplier * sd * Math.sqrt(1 + 1 / n + (x - xMean) ** 2 / denominator),
        upperBound: predicted + this.config.confidenceMultiplier * sd * Math.sqrt(1 + 1 / n + (x - xMean) ** 2 / denominator),
        confidence: Math.max(0.5, 0.95 - 0.02 * h),
      });
    }

    return results;
  }

  // -- 계절성 분해 -- Design §3 ──────────────────────────────────────────

  /** 계절성 분해 */
  decomposeSeasonal(values: number[], period: number): SeasonalDecomposition {
    const n = values.length;
    if (n < period * 2) {
      return { trend: values, seasonal: new Array(n).fill(0), residual: new Array(n).fill(0), period };
    }

    // 이동평균 추세 추출
    const trend: number[] = [];
    const halfPeriod = Math.floor(period / 2);
    for (let i = 0; i < n; i++) {
      if (i < halfPeriod || i >= n - halfPeriod) {
        trend.push(values[i] ?? 0);
      } else {
        const window = values.slice(i - halfPeriod, i + halfPeriod + 1);
        trend.push(mean(window));
      }
    }

    // 계절성 추출
    const detrended = values.map((v, i) => v - (trend[i] ?? 0));
    const seasonal = new Array(n).fill(0) as number[];
    for (let s = 0; s < period; s++) {
      const seasonalValues: number[] = [];
      for (let i = s; i < n; i += period) {
        seasonalValues.push(detrended[i] ?? 0);
      }
      const avgSeasonal = mean(seasonalValues);
      for (let i = s; i < n; i += period) {
        seasonal[i] = avgSeasonal;
      }
    }

    // 잔차
    const residual = values.map((v, i) => v - (trend[i] ?? 0) - (seasonal[i] ?? 0));

    return { trend, seasonal, residual, period };
  }

  // -- 앙상블 예측 -- Design §5 ──────────────────────────────────────────

  /** 앙상블 예측 (가중 평균) */
  forecastEnsemble(data: TimeSeriesPoint[], horizons: number): ForecastResult[] {
    const smaResults = this.forecastSMA(data, horizons);
    const emaResults = this.forecastEMA(data, horizons);
    const linearResults = this.forecastLinear(data, horizons);

    // 모델별 MAPE 계산 (최근 데이터로 백테스트)
    const metrics = this.evaluateModels(data);
    const weights = this.calculateWeights(metrics);

    const results: ForecastResult[] = [];
    for (let h = 0; h < horizons; h++) {
      const sma = smaResults[h];
      const ema = emaResults[h];
      const linear = linearResults[h];

      if (!sma || !ema || !linear) continue;

      const predicted =
        (weights['sma'] ?? 0) * sma.predicted +
        (weights['ema'] ?? 0) * ema.predicted +
        (weights['linear'] ?? 0) * linear.predicted;

      const allPredicted = [sma.predicted, ema.predicted, linear.predicted];
      const sd = stddev(allPredicted, predicted);

      results.push({
        timestamp: sma.timestamp,
        predicted,
        lowerBound: predicted - this.config.confidenceMultiplier * sd,
        upperBound: predicted + this.config.confidenceMultiplier * sd,
        confidence: Math.max(sma.confidence, ema.confidence, linear.confidence),
      });
    }

    return results;
  }

  // -- 모델 평가 ─────────────────────────────────────────────────────────

  /** 모델 성능 평가 (MAPE 기반) */
  evaluateModels(data: TimeSeriesPoint[]): ModelMetrics[] {
    if (data.length < 10) {
      return [
        { model: 'sma', mape: 10, rmse: 0, mae: 0 },
        { model: 'ema', mape: 10, rmse: 0, mae: 0 },
        { model: 'linear', mape: 10, rmse: 0, mae: 0 },
      ];
    }

    const split = Math.floor(data.length * 0.8);
    const train = data.slice(0, split);
    const test = data.slice(split);

    const models: { model: ForecastModel; forecast: ForecastResult[] }[] = [
      { model: 'sma', forecast: this.forecastSMA(train, test.length) },
      { model: 'ema', forecast: this.forecastEMA(train, test.length) },
      { model: 'linear', forecast: this.forecastLinear(train, test.length) },
    ];

    return models.map(({ model, forecast }) => {
      let totalApe = 0;
      let totalSe = 0;
      let totalAe = 0;
      let count = 0;

      for (let i = 0; i < Math.min(test.length, forecast.length); i++) {
        const actual = test[i]!.value;
        const predicted = forecast[i]!.predicted;
        if (actual !== 0) {
          totalApe += Math.abs((actual - predicted) / actual);
        }
        totalSe += (actual - predicted) ** 2;
        totalAe += Math.abs(actual - predicted);
        count++;
      }

      return {
        model,
        mape: count > 0 ? (totalApe / count) * 100 : 100,
        rmse: count > 0 ? Math.sqrt(totalSe / count) : 0,
        mae: count > 0 ? totalAe / count : 0,
      };
    });
  }

  /** MAPE 역수 가중치 계산 */
  private calculateWeights(metrics: ModelMetrics[]): Record<string, number> {
    const inverses = metrics.map((m) => 1 / Math.max(m.mape, 0.1));
    const total = inverses.reduce((s, v) => s + v, 0);

    const weights: Record<string, number> = {};
    metrics.forEach((m, i) => {
      weights[m.model] = (inverses[i] ?? 0) / total;
    });

    return weights;
  }

  // -- 통합 예측 ─────────────────────────────────────────────────────────

  /** 통합 예측 (설정에 따라 앙상블 또는 단일 모델) */
  forecast(
    data: TimeSeriesPoint[],
    horizons: number,
    model?: ForecastModel,
  ): ForecastResult[] {
    const processed = this.preprocess(data);
    if (processed.length < 3) return [];

    const selectedModel = model ?? (this.config.enableEnsemble ? 'ensemble' : 'ema');

    let results: ForecastResult[];
    switch (selectedModel) {
      case 'sma':
        results = this.forecastSMA(processed, horizons);
        break;
      case 'ema':
        results = this.forecastEMA(processed, horizons);
        break;
      case 'linear':
        results = this.forecastLinear(processed, horizons);
        break;
      case 'ensemble':
        results = this.forecastEnsemble(processed, horizons);
        break;
      default:
        results = this.forecastEMA(processed, horizons);
    }

    auditLog('forecast_generated', {
      model: selectedModel,
      dataPoints: processed.length,
      horizons,
    });

    return results;
  }

  // -- 비용 예측 -- Design §6 ────────────────────────────────────────────

  /** 월간 비용 예측 */
  forecastCost(
    monthlyData: TimeSeriesPoint[],
    monthsAhead: number,
  ): CostForecast[] {
    const forecasts = this.forecast(monthlyData, monthsAhead);
    const values = monthlyData.map((p) => p.value);
    const recentTrend = values.length >= 2
      ? (values[values.length - 1] ?? 0) - (values[values.length - 2] ?? 0)
      : 0;

    return forecasts.map((f) => ({
      month: f.timestamp.slice(0, 7),
      predictedCost: Math.max(0, f.predicted),
      lowerBound: Math.max(0, f.lowerBound),
      upperBound: Math.max(0, f.upperBound),
      trend: recentTrend > 0.05 * mean(values) ? 'increasing'
        : recentTrend < -0.05 * mean(values) ? 'decreasing'
        : 'stable',
    }));
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let forecasterInstance: TimeSeriesForecaster | null = null;

export function getTimeSeriesForecaster(
  config?: Partial<ForecasterConfig>,
): TimeSeriesForecaster {
  if (!forecasterInstance) {
    forecasterInstance = new TimeSeriesForecaster(config);
  }
  return forecasterInstance;
}

export function resetTimeSeriesForecaster(): void {
  forecasterInstance = null;
}
