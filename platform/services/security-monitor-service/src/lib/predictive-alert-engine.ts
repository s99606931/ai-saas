/**
 * 예측적 장애 방지 엔진 (Predictive Alerting Engine)
 * Design Ref: docs/02-design/mtus/MTU-N242-predictive-alerting.design.md
 * Plan SC: FR-PA.1~FR-PA.5
 *
 * 메트릭 시계열 기반 선형 회귀 예측 + 다중 윈도우 알림
 * predict_linear() 동등 구현 — 디스크/메모리/인증서/SLO/PV 시나리오
 * CSAP D-06 감사 로깅 연동, D-12 시스템 개발 보안
 */

/** 예측 시나리오 유형 */
export enum PredictionScenario {
  /** 디스크 용량 고갈 예측 */
  DiskFull = 'DISK_FULL',
  /** 메모리 OOM 예측 */
  MemoryOOM = 'MEMORY_OOM',
  /** 인증서 만료 예측 */
  CertExpiry = 'CERT_EXPIRY',
  /** SLO 위반 예측 */
  SLOBreach = 'SLO_BREACH',
  /** PV 포화 예측 */
  PVSaturation = 'PV_SATURATION',
}

/** 예측 윈도우 (초 단위) */
export interface PredictionWindow {
  /** 윈도우 이름 */
  name: string;
  /** 윈도우 크기 (초) */
  seconds: number;
}

/** 메트릭 데이터 포인트 */
export interface MetricDataPoint {
  /** 타임스탬프 (밀리초) */
  timestamp: number;
  /** 메트릭 값 */
  value: number;
}

/** 선형 회귀 결과 */
export interface LinearRegressionResult {
  /** 기울기 (단위/초) */
  slope: number;
  /** y절편 */
  intercept: number;
  /** 결정 계수 (R-squared) */
  rSquared: number;
}

/** 예측 결과 */
export interface PredictionResult {
  /** 시나리오 */
  scenario: PredictionScenario;
  /** 현재 값 */
  currentValue: number;
  /** 예측 윈도우별 결과 */
  windows: WindowPrediction[];
  /** 선형 회귀 품질 */
  regressionQuality: number;
  /** 데이터 포인트 수 */
  dataPointCount: number;
  /** 예측 시각 */
  predictedAt: string;
}

/** 윈도우별 예측 */
export interface WindowPrediction {
  /** 윈도우 이름 */
  windowName: string;
  /** 윈도우 크기 (초) */
  windowSeconds: number;
  /** 예측 값 */
  predictedValue: number;
  /** 임계값 초과 여부 */
  breachExpected: boolean;
  /** 임계값 도달까지 남은 시간 (초, null=도달 안 함) */
  timeToBreachSeconds: number | null;
}

/** 예측 알림 */
export interface PredictiveAlert {
  /** 알림 ID */
  alertId: string;
  /** 시나리오 */
  scenario: PredictionScenario;
  /** 심각도 */
  severity: 'critical' | 'warning' | 'info';
  /** 알림 제목 */
  title: string;
  /** 알림 설명 */
  description: string;
  /** 예측 값 */
  predictedValue: number;
  /** 현재 값 */
  currentValue: number;
  /** 임계값 */
  threshold: number;
  /** 임계값 도달 예상 시각 */
  estimatedBreachAt: string | null;
  /** 알림 발생 시각 */
  firedAt: string;
  /** 메타 데이터 (대상 리소스 등) */
  labels: Record<string, string>;
}

/** 시나리오별 구성 */
export interface ScenarioConfig {
  /** 시나리오 */
  scenario: PredictionScenario;
  /** 메트릭 이름 */
  metricName: string;
  /** 예측 윈도우 목록 */
  windows: PredictionWindow[];
  /** 임계값 (초과 시 알림) */
  threshold: number;
  /** 임계값 방향: 'above'=값이 threshold 이상, 'below'=값이 threshold 이하 */
  direction: 'above' | 'below';
  /** 알림 심각도 */
  severity: 'critical' | 'warning' | 'info';
  /** 최소 데이터 포인트 수 */
  minDataPoints: number;
  /** 최소 R-squared (예측 품질 필터) */
  minRSquared: number;
}

/** 예측 정확도 추적 */
export interface PredictionAccuracy {
  /** 전체 예측 수 */
  totalPredictions: number;
  /** 실현된 예측 (정탐) */
  truePredictions: number;
  /** 미실현 예측 (오탐) */
  falsePredictions: number;
  /** 미평가 (아직 윈도우 미경과) */
  pendingPredictions: number;
  /** 정확도 (0.0 ~ 1.0) */
  accuracy: number;
  /** 오탐률 (0.0 ~ 1.0) */
  falsePositiveRate: number;
}

/** 기본 시나리오 구성 — Design Ref: 예측 시나리오 테이블 */
const DEFAULT_SCENARIOS: ScenarioConfig[] = [
  {
    scenario: PredictionScenario.DiskFull,
    metricName: 'node_filesystem_free_bytes',
    windows: [
      { name: '4h', seconds: 4 * 3600 },
      { name: '24h', seconds: 24 * 3600 },
      { name: '7d', seconds: 7 * 24 * 3600 },
    ],
    threshold: 10, // 10% 미만이면 알림
    direction: 'below',
    severity: 'critical',
    minDataPoints: 10,
    minRSquared: 0.5,
  },
  {
    scenario: PredictionScenario.MemoryOOM,
    metricName: 'container_memory_usage_bytes',
    windows: [
      { name: '1h', seconds: 3600 },
      { name: '4h', seconds: 4 * 3600 },
    ],
    threshold: 90, // 90% 초과이면 알림
    direction: 'above',
    severity: 'critical',
    minDataPoints: 10,
    minRSquared: 0.5,
  },
  {
    scenario: PredictionScenario.CertExpiry,
    metricName: 'certmanager_certificate_expiration_timestamp',
    windows: [
      { name: '30d', seconds: 30 * 24 * 3600 },
      { name: '7d', seconds: 7 * 24 * 3600 },
      { name: '1d', seconds: 24 * 3600 },
    ],
    threshold: 0, // 남은 초가 0 이하이면 알림
    direction: 'below',
    severity: 'critical',
    minDataPoints: 3,
    minRSquared: 0.3,
  },
  {
    scenario: PredictionScenario.SLOBreach,
    metricName: 'error_rate_5m',
    windows: [
      { name: '1h', seconds: 3600 },
      { name: '6h', seconds: 6 * 3600 },
    ],
    threshold: 5, // 에러율 5% 초과이면 알림
    direction: 'above',
    severity: 'warning',
    minDataPoints: 10,
    minRSquared: 0.4,
  },
  {
    scenario: PredictionScenario.PVSaturation,
    metricName: 'kubelet_volume_stats_used_bytes',
    windows: [
      { name: '24h', seconds: 24 * 3600 },
    ],
    threshold: 85, // 85% 초과이면 알림
    direction: 'above',
    severity: 'warning',
    minDataPoints: 10,
    minRSquared: 0.5,
  },
];

export class PredictiveAlertEngine {
  private readonly scenarios: ScenarioConfig[];
  private readonly metricStore: Map<string, MetricDataPoint[]> = new Map();
  private readonly alertHistory: PredictiveAlert[] = [];
  private readonly predictionLog: Array<{
    scenario: PredictionScenario;
    predicted: boolean;
    actualBreached: boolean | null;
    windowSeconds: number;
    predictedAt: number;
    checkAt: number;
  }> = [];
  private readonly maxDataPoints: number;
  private readonly maxAlertHistory: number;

  constructor(options?: {
    scenarios?: ScenarioConfig[];
    maxDataPoints?: number;
    maxAlertHistory?: number;
  }) {
    this.scenarios = options?.scenarios ?? [...DEFAULT_SCENARIOS];
    this.maxDataPoints = options?.maxDataPoints ?? 10000;
    this.maxAlertHistory = options?.maxAlertHistory ?? 5000;
  }

  /**
   * 메트릭 데이터 포인트 기록
   * Design Ref: FR-PA.1~FR-PA.4 — 메트릭 수집
   */
  ingestMetric(metricName: string, value: number, timestamp?: number): void {
    const ts = timestamp ?? Date.now();
    let points = this.metricStore.get(metricName);
    if (!points) {
      points = [];
      this.metricStore.set(metricName, points);
    }

    points.push({ timestamp: ts, value });

    // 메모리 관리: 최대 포인트 수 초과 시 오래된 것 제거
    if (points.length > this.maxDataPoints) {
      const excess = points.length - this.maxDataPoints;
      points.splice(0, excess);
    }
  }

  /**
   * 메트릭 일괄 수집
   */
  ingestMetrics(metricName: string, dataPoints: MetricDataPoint[]): void {
    for (const dp of dataPoints) {
      this.ingestMetric(metricName, dp.value, dp.timestamp);
    }
  }

  /**
   * 선형 회귀 (predict_linear 동등)
   * Design Ref: 예측 알고리즘 — predict_linear(v range-vector, t scalar)
   */
  linearRegression(points: MetricDataPoint[]): LinearRegressionResult {
    if (points.length < 2) {
      return { slope: 0, intercept: 0, rSquared: 0 };
    }

    const n = points.length;
    // 정규화: 첫 타임스탬프를 0으로
    const t0 = points[0]!.timestamp;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;

    for (const p of points) {
      const x = (p.timestamp - t0) / 1000; // 초 단위
      const y = p.value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
      sumYY += y * y;
    }

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-12) {
      // 모든 x 값이 동일 (시계열 불가)
      return { slope: 0, intercept: sumY / n, rSquared: 0 };
    }

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared 계산
    const meanY = sumY / n;
    const ssTot = sumYY - n * meanY * meanY;
    const ssRes = points.reduce((sum, p) => {
      const x = (p.timestamp - t0) / 1000;
      const predicted = slope * x + intercept;
      return sum + (p.value - predicted) ** 2;
    }, 0);

    const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    return {
      slope: Math.round(slope * 1e10) / 1e10,
      intercept: Math.round(intercept * 1e6) / 1e6,
      rSquared: Math.round(rSquared * 10000) / 10000,
    };
  }

  /**
   * predict_linear: t초 후의 예측값 계산
   */
  predictLinear(points: MetricDataPoint[], futureSeconds: number): number {
    const reg = this.linearRegression(points);
    if (points.length === 0) return 0;

    const t0 = points[0]!.timestamp;
    const lastPoint = points[points.length - 1]!;
    const lastX = (lastPoint.timestamp - t0) / 1000;
    const futureX = lastX + futureSeconds;

    return reg.slope * futureX + reg.intercept;
  }

  /**
   * 특정 시나리오의 예측 실행
   * Design Ref: FR-PA.1~FR-PA.4
   */
  predict(scenarioType: PredictionScenario): PredictionResult | null {
    const config = this.scenarios.find(s => s.scenario === scenarioType);
    if (!config) return null;

    const points = this.metricStore.get(config.metricName) ?? [];
    if (points.length < config.minDataPoints) return null;

    const reg = this.linearRegression(points);
    if (reg.rSquared < config.minRSquared) {
      // 예측 품질 미달 — 결과는 반환하되 breach 미표시
      const currentValue = points[points.length - 1]!.value;
      return {
        scenario: scenarioType,
        currentValue,
        windows: config.windows.map(w => ({
          windowName: w.name,
          windowSeconds: w.seconds,
          predictedValue: this.predictLinear(points, w.seconds),
          breachExpected: false,
          timeToBreachSeconds: null,
        })),
        regressionQuality: reg.rSquared,
        dataPointCount: points.length,
        predictedAt: new Date().toISOString(),
      };
    }

    const currentValue = points[points.length - 1]!.value;
    const windows: WindowPrediction[] = config.windows.map(w => {
      const predicted = this.predictLinear(points, w.seconds);
      const breachExpected = config.direction === 'above'
        ? predicted >= config.threshold
        : predicted <= config.threshold;

      // 임계값 도달 시간 계산
      let timeToBreachSeconds: number | null = null;
      if (reg.slope !== 0) {
        const t0 = points[0]!.timestamp;
        const lastPoint = points[points.length - 1]!;
        const lastX = (lastPoint.timestamp - t0) / 1000;
        // threshold = slope * x + intercept → x = (threshold - intercept) / slope
        const breachX = (config.threshold - reg.intercept) / reg.slope;
        const secondsUntilBreach = breachX - lastX;

        if (secondsUntilBreach > 0) {
          timeToBreachSeconds = Math.round(secondsUntilBreach);
        }
      }

      return {
        windowName: w.name,
        windowSeconds: w.seconds,
        predictedValue: Math.round(predicted * 100) / 100,
        breachExpected,
        timeToBreachSeconds,
      };
    });

    return {
      scenario: scenarioType,
      currentValue,
      windows,
      regressionQuality: reg.rSquared,
      dataPointCount: points.length,
      predictedAt: new Date().toISOString(),
    };
  }

  /**
   * 전체 시나리오 예측 + 알림 생성
   * Design Ref: FR-PA.1~FR-PA.4 — 다중 시나리오 예측 실행
   */
  evaluateAll(): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];

    for (const config of this.scenarios) {
      const result = this.predict(config.scenario);
      if (!result) continue;

      for (const window of result.windows) {
        if (window.breachExpected) {
          const alert: PredictiveAlert = {
            alertId: `pred-${config.scenario}-${window.windowName}-${Date.now()}`,
            scenario: config.scenario,
            severity: config.severity,
            title: this.getAlertTitle(config.scenario, window.windowName),
            description: this.getAlertDescription(config, result, window),
            predictedValue: window.predictedValue,
            currentValue: result.currentValue,
            threshold: config.threshold,
            estimatedBreachAt: window.timeToBreachSeconds !== null
              ? new Date(Date.now() + window.timeToBreachSeconds * 1000).toISOString()
              : null,
            firedAt: new Date().toISOString(),
            labels: {
              scenario: config.scenario,
              metric: config.metricName,
              window: window.windowName,
            },
          };

          alerts.push(alert);
          this.alertHistory.push(alert);

          // 예측 로그 기록
          this.predictionLog.push({
            scenario: config.scenario,
            predicted: true,
            actualBreached: null, // 아직 미확인
            windowSeconds: window.windowSeconds,
            predictedAt: Date.now(),
            checkAt: Date.now() + window.windowSeconds * 1000,
          });
        }
      }
    }

    // 알림 히스토리 크기 제한
    if (this.alertHistory.length > this.maxAlertHistory) {
      this.alertHistory.splice(0, this.alertHistory.length - this.maxAlertHistory);
    }

    return alerts;
  }

  /**
   * 예측 정확도 추적
   * Design Ref: FR-PA.5 — 예측 알림 정확도 추적, 오탐률 최소화
   */
  getAccuracy(): PredictionAccuracy {
    const now = Date.now();
    let truePredictions = 0;
    let falsePredictions = 0;
    let pendingPredictions = 0;

    for (const log of this.predictionLog) {
      if (now < log.checkAt) {
        pendingPredictions++;
      } else if (log.actualBreached === true) {
        truePredictions++;
      } else if (log.actualBreached === false) {
        falsePredictions++;
      } else {
        pendingPredictions++;
      }
    }

    const evaluated = truePredictions + falsePredictions;
    const accuracy = evaluated > 0 ? truePredictions / evaluated : 0;
    const falsePositiveRate = evaluated > 0 ? falsePredictions / evaluated : 0;

    return {
      totalPredictions: this.predictionLog.length,
      truePredictions,
      falsePredictions,
      pendingPredictions,
      accuracy: Math.round(accuracy * 10000) / 10000,
      falsePositiveRate: Math.round(falsePositiveRate * 10000) / 10000,
    };
  }

  /**
   * 예측 결과 검증 (실현 여부 업데이트)
   */
  validatePrediction(scenario: PredictionScenario, breached: boolean): number {
    let updated = 0;
    const now = Date.now();

    for (const log of this.predictionLog) {
      if (log.scenario === scenario && log.actualBreached === null && now >= log.checkAt) {
        log.actualBreached = breached;
        updated++;
      }
    }

    return updated;
  }

  /**
   * 시나리오 구성 목록 조회
   */
  getScenarios(): ScenarioConfig[] {
    return [...this.scenarios];
  }

  /**
   * 알림 이력 조회
   */
  getAlertHistory(limit: number = 50): PredictiveAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * 메트릭 데이터 포인트 수 조회
   */
  getMetricCount(metricName: string): number {
    return this.metricStore.get(metricName)?.length ?? 0;
  }

  /**
   * 전체 메트릭 이름 목록
   */
  getMetricNames(): string[] {
    return Array.from(this.metricStore.keys());
  }

  /**
   * 트렌드 요약 대시보드 데이터
   * Design Ref: FR-PA.5 — 예측 대시보드 (트렌드 시각화)
   */
  getDashboardSummary(): {
    scenarios: Array<{
      scenario: PredictionScenario;
      metricName: string;
      dataPoints: number;
      hasAlert: boolean;
      regressionQuality: number | null;
    }>;
    recentAlerts: PredictiveAlert[];
    accuracy: PredictionAccuracy;
  } {
    const scenarios = this.scenarios.map(config => {
      const result = this.predict(config.scenario);
      const hasAlert = result
        ? result.windows.some(w => w.breachExpected)
        : false;

      return {
        scenario: config.scenario,
        metricName: config.metricName,
        dataPoints: this.getMetricCount(config.metricName),
        hasAlert,
        regressionQuality: result?.regressionQuality ?? null,
      };
    });

    return {
      scenarios,
      recentAlerts: this.alertHistory.slice(-10),
      accuracy: this.getAccuracy(),
    };
  }

  /**
   * 알림 제목 생성
   */
  private getAlertTitle(scenario: PredictionScenario, window: string): string {
    const titles: Record<PredictionScenario, string> = {
      [PredictionScenario.DiskFull]: `디스크 용량 고갈 예측 (${window} 이내)`,
      [PredictionScenario.MemoryOOM]: `메모리 OOM 예측 (${window} 이내)`,
      [PredictionScenario.CertExpiry]: `인증서 만료 예측 (${window} 이내)`,
      [PredictionScenario.SLOBreach]: `SLO 위반 예측 (${window} 이내)`,
      [PredictionScenario.PVSaturation]: `PV 포화 예측 (${window} 이내)`,
    };
    return titles[scenario];
  }

  /**
   * 알림 설명 생성
   */
  private getAlertDescription(
    config: ScenarioConfig,
    result: PredictionResult,
    window: WindowPrediction,
  ): string {
    const directionText = config.direction === 'above' ? '초과' : '미만';
    const timeText = window.timeToBreachSeconds !== null
      ? `약 ${Math.round(window.timeToBreachSeconds / 3600)}시간 후`
      : '예측 윈도우 내';

    return (
      `${config.metricName} 메트릭이 ${window.windowName} 이내에 ` +
      `임계값(${config.threshold}) ${directionText} 예측. ` +
      `현재: ${result.currentValue}, 예측: ${window.predictedValue}. ` +
      `${timeText} 임계값 도달 예상. ` +
      `회귀 품질(R²): ${result.regressionQuality}`
    );
  }
}
