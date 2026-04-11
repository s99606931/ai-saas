// 용량 예측기 -- FR-ADV36.4
// Design Ref: SVC-AI-ADV-R36 DESIGN §4
// Plan SC: SC-4 (임계 도달 시점 예측 정확도)
// CSAP: D-06 용량 관리 감사

import {
  TimeSeriesForecaster,
  getTimeSeriesForecaster,
  type TimeSeriesPoint,
  type ForecastResult,
} from './time-series-forecaster';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 리소스 유형 */
export type ResourceType = 'cpu' | 'memory' | 'disk' | 'network' | 'connections';

/** 리소스 임계값 설정 */
export interface ResourceThreshold {
  resource: ResourceType;
  warningPercent: number;
  criticalPercent: number;
  unit: string;
  maxCapacity: number;
}

/** 용량 예측 결과 -- Design §4 */
export interface CapacityPrediction {
  resource: ResourceType;
  currentUsage: number;
  currentPercent: number;
  warningDate?: string;
  criticalDate?: string;
  daysToWarning?: number;
  daysToCritical?: number;
  trend: 'growing' | 'stable' | 'declining';
  growthRate: number;
  forecast: ForecastResult[];
  recommendation: string;
}

/** 시스템 용량 보고서 */
export interface CapacityReport {
  timestamp: string;
  predictions: CapacityPrediction[];
  overallStatus: 'healthy' | 'warning' | 'critical';
  urgentResources: ResourceType[];
}

/** 예측기 설정 */
export interface CapacityPredictorConfig {
  /** 예측 기간 (일) */
  forecastDays: number;
  /** 리소스별 임계값 */
  thresholds: ResourceThreshold[];
  /** 예측기 인스턴스 */
  forecaster?: TimeSeriesForecaster;
}

// -- 기본 임계값 ─────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: ResourceThreshold[] = [
  { resource: 'cpu', warningPercent: 80, criticalPercent: 95, unit: '%', maxCapacity: 100 },
  { resource: 'memory', warningPercent: 85, criticalPercent: 95, unit: '%', maxCapacity: 100 },
  { resource: 'disk', warningPercent: 80, criticalPercent: 90, unit: '%', maxCapacity: 100 },
  { resource: 'network', warningPercent: 70, criticalPercent: 90, unit: 'Mbps', maxCapacity: 1000 },
  { resource: 'connections', warningPercent: 75, criticalPercent: 90, unit: 'count', maxCapacity: 10000 },
];

const DEFAULT_CONFIG: CapacityPredictorConfig = {
  forecastDays: 90,
  thresholds: DEFAULT_THRESHOLDS,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'capacity-predictor',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- CapacityPredictor 메인 클래스 ────────────────────────────────────────────

/** 용량 예측기 -- Design §4 */
export class CapacityPredictor {
  private readonly config: CapacityPredictorConfig;
  private readonly forecaster: TimeSeriesForecaster;

  constructor(config?: Partial<CapacityPredictorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.forecaster = config?.forecaster ?? getTimeSeriesForecaster();
  }

  // -- 단일 리소스 예측 ──────────────────────────────────────────────────

  /** 리소스 용량 예측 -- Design §4 */
  predictResource(
    resource: ResourceType,
    data: TimeSeriesPoint[],
  ): CapacityPrediction {
    const threshold = this.config.thresholds.find((t) => t.resource === resource)
      ?? DEFAULT_THRESHOLDS.find((t) => t.resource === resource)!;

    // 현재 사용량
    const currentUsage = data.length > 0
      ? (data[data.length - 1]?.value ?? 0)
      : 0;
    const currentPercent = (currentUsage / threshold.maxCapacity) * 100;

    // 예측 실행
    const forecast = this.forecaster.forecast(data, this.config.forecastDays);

    // 추세 계산
    const values = data.map((p) => p.value);
    const recentValues = values.slice(-7);
    const growthRate = recentValues.length >= 2
      ? ((recentValues[recentValues.length - 1] ?? 0) - (recentValues[0] ?? 0)) / recentValues.length
      : 0;

    const trend: CapacityPrediction['trend'] =
      growthRate > 0.01 ? 'growing'
      : growthRate < -0.01 ? 'declining'
      : 'stable';

    // 임계 도달 시점 탐색
    const warningThreshold = threshold.warningPercent * threshold.maxCapacity / 100;
    const criticalThreshold = threshold.criticalPercent * threshold.maxCapacity / 100;

    let warningDate: string | undefined;
    let criticalDate: string | undefined;
    let daysToWarning: number | undefined;
    let daysToCritical: number | undefined;

    for (let i = 0; i < forecast.length; i++) {
      if (!warningDate && forecast[i]!.predicted >= warningThreshold) {
        warningDate = forecast[i]!.timestamp;
        daysToWarning = i + 1;
      }
      if (!criticalDate && forecast[i]!.predicted >= criticalThreshold) {
        criticalDate = forecast[i]!.timestamp;
        daysToCritical = i + 1;
      }
    }

    // 권장 사항 생성
    const recommendation = this.generateRecommendation(
      resource,
      currentPercent,
      daysToWarning,
      daysToCritical,
      trend,
    );

    return {
      resource,
      currentUsage,
      currentPercent,
      warningDate,
      criticalDate,
      daysToWarning,
      daysToCritical,
      trend,
      growthRate,
      forecast,
      recommendation,
    };
  }

  // -- 전체 시스템 용량 보고서 ────────────────────────────────────────────

  /** 시스템 용량 종합 보고서 생성 */
  generateReport(
    resourceData: Map<ResourceType, TimeSeriesPoint[]>,
  ): CapacityReport {
    const predictions: CapacityPrediction[] = [];
    const urgentResources: ResourceType[] = [];
    let worstStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    for (const [resource, data] of resourceData) {
      const prediction = this.predictResource(resource, data);
      predictions.push(prediction);

      // 상태 판정
      if (prediction.daysToCritical !== undefined && prediction.daysToCritical <= 7) {
        worstStatus = 'critical';
        urgentResources.push(resource);
      } else if (prediction.daysToWarning !== undefined && prediction.daysToWarning <= 14) {
        if (worstStatus !== 'critical') worstStatus = 'warning';
        urgentResources.push(resource);
      }
    }

    const report: CapacityReport = {
      timestamp: new Date().toISOString(),
      predictions,
      overallStatus: worstStatus,
      urgentResources,
    };

    auditLog('capacity_report_generated', {
      overallStatus: worstStatus,
      urgentResources,
      resourceCount: predictions.length,
    });

    return report;
  }

  // -- 권장 사항 생성 ────────────────────────────────────────────────────

  private generateRecommendation(
    resource: ResourceType,
    currentPercent: number,
    daysToWarning?: number,
    daysToCritical?: number,
    trend?: string,
  ): string {
    const resourceKo: Record<ResourceType, string> = {
      cpu: 'CPU',
      memory: '메모리',
      disk: '디스크',
      network: '네트워크',
      connections: '연결 수',
    };

    const name = resourceKo[resource];

    if (daysToCritical !== undefined && daysToCritical <= 7) {
      return `긴급: ${name} 임계점 ${daysToCritical}일 내 도달 예상. 즉시 스케일업 필요.`;
    }
    if (daysToCritical !== undefined && daysToCritical <= 30) {
      return `경고: ${name} 임계점 ${daysToCritical}일 내 도달 예상. 용량 확장 계획 수립 권장.`;
    }
    if (daysToWarning !== undefined && daysToWarning <= 14) {
      return `주의: ${name} 경고 임계값 ${daysToWarning}일 내 도달 예상. 모니터링 강화 권장.`;
    }
    if (trend === 'growing' && currentPercent > 50) {
      return `참고: ${name} 사용량 증가 추세 (현재 ${currentPercent.toFixed(1)}%). 장기 계획 검토 권장.`;
    }

    return `정상: ${name} 사용량 안정 (현재 ${currentPercent.toFixed(1)}%)`;
  }

  // -- 임계값 관리 ───────────────────────────────────────────────────────

  /** 임계값 업데이트 */
  updateThreshold(resource: ResourceType, threshold: Partial<ResourceThreshold>): void {
    const existing = this.config.thresholds.find((t) => t.resource === resource);
    if (existing) {
      Object.assign(existing, threshold);
    }
  }

  /** 임계값 조회 */
  getThresholds(): ResourceThreshold[] {
    return [...this.config.thresholds];
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let predictorInstance: CapacityPredictor | null = null;

export function getCapacityPredictor(
  config?: Partial<CapacityPredictorConfig>,
): CapacityPredictor {
  if (!predictorInstance) {
    predictorInstance = new CapacityPredictor(config);
  }
  return predictorInstance;
}

export function resetCapacityPredictor(): void {
  predictorInstance = null;
}
