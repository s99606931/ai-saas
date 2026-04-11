// AI 이상 탐지 엔진 -- FR-ADV30.1, FR-ADV30.3~30.7
// Design Ref: SVC-AI-ADV-R30 DESIGN §1, §3~§7
// Plan SC: SC-1 (정확도 90%+), SC-2 (오탐률 5% 이하), SC-3 (감지 지연 < 30초)
// CSAP: D-06 침해사고 자동 감지, D-12 보안 이벤트 모니터링

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 이상 심각도 -- Design §4 */
export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

/** 이상 유형 */
export type AnomalyType =
  | 'security_breach'
  | 'access_pattern'
  | 'performance_degradation'
  | 'error_spike'
  | 'data_exfiltration'
  | 'resource_exhaustion'
  | 'configuration_drift'
  | 'unknown';

/** 탐지 알고리즘 */
export type DetectionAlgorithm = 'z_score' | 'iqr' | 'moving_average';

/** 메트릭 데이터 포인트 */
export interface MetricPoint {
  timestamp: string;
  value: number;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/** 이상 탐지 결과 */
export interface AnomalyResult {
  id: string;
  timestamp: string;
  severity: AnomalySeverity;
  type: AnomalyType;
  source: string;
  value: number;
  baseline: number;
  deviation: number;
  algorithms: DetectionAlgorithm[];
  confidence: number;
  description: string;
  metadata?: Record<string, unknown>;
}

/** 기준선 통계 -- Design §6 */
export interface BaselineStats {
  mean: number;
  stddev: number;
  q1: number;
  q3: number;
  iqr: number;
  movingAverage: number;
  sampleCount: number;
  lastUpdated: string;
}

/** 알림 설정 -- Design §5 */
export interface AlertConfig {
  webhookUrl?: string;
  minSeverity: AnomalySeverity;
  cooldownMs: number;
  enabled: boolean;
}

/** 스트리밍 윈도우 설정 -- Design §3 */
export interface WindowConfig {
  /** 윈도우 크기 (ms) */
  windowSize: number;
  /** 슬라이드 간격 (ms) */
  slideInterval: number;
  /** 최대 버퍼 크기 */
  maxBufferSize: number;
}

/** 탐지기 설정 */
export interface AnomalyDetectorConfig {
  /** Z-Score 임계값 (기본 3.0) */
  zScoreThreshold: number;
  /** IQR 계수 (기본 1.5) */
  iqrMultiplier: number;
  /** 이동평균 윈도우 크기 */
  movingAverageWindow: number;
  /** 투표 임계값 (2/3 = 이상 확정) */
  voteThreshold: number;
  /** 스트리밍 윈도우 설정 */
  window: WindowConfig;
  /** 알림 설정 */
  alert: AlertConfig;
  /** 기준선 갱신 주기 (ms) */
  baselineRefreshInterval: number;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AnomalyDetectorConfig = {
  zScoreThreshold: 3.0,
  iqrMultiplier: 1.5,
  movingAverageWindow: 30,
  voteThreshold: 2,
  window: {
    windowSize: 60_000,
    slideInterval: 10_000,
    maxBufferSize: 10_000,
  },
  alert: {
    minSeverity: 'high',
    cooldownMs: 300_000, // 5분
    enabled: true,
  },
  baselineRefreshInterval: 6 * 60 * 60 * 1000, // 6시간
};

const SEVERITY_ORDER: Record<AnomalySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'anomaly-detector',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- 통계 유틸 ────────────────────────────────────────────────────────────────

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStddev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1));
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower);
}

function generateId(): string {
  return `anomaly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// -- AnomalyDetector 메인 클래스 ──────────────────────────────────────────────

/** AI 이상 탐지 엔진 -- Design §1 */
export class AnomalyDetector {
  private readonly config: AnomalyDetectorConfig;
  private baselines: Map<string, BaselineStats> = new Map();
  private eventBuffer: MetricPoint[] = [];
  private lastAlertTime: Map<string, number> = new Map();
  private windowTimer: ReturnType<typeof setInterval> | null = null;
  private baselineTimer: ReturnType<typeof setInterval> | null = null;
  private onAnomalyCallbacks: ((result: AnomalyResult) => void)[] = [];

  constructor(config?: Partial<AnomalyDetectorConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      window: { ...DEFAULT_CONFIG.window, ...config?.window },
      alert: { ...DEFAULT_CONFIG.alert, ...config?.alert },
    };
  }

  // -- 기준선 관리 ────────────────────────────────────────────────────────

  /** 기준선 계산 -- Design §6 */
  calculateBaseline(values: number[]): BaselineStats {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = calculateMean(values);
    const stddev = calculateStddev(values, mean);
    const q1 = calculatePercentile(sorted, 25);
    const q3 = calculatePercentile(sorted, 75);
    const iqr = q3 - q1;

    const recentWindow = values.slice(-this.config.movingAverageWindow);
    const movingAverage = calculateMean(recentWindow);

    return {
      mean,
      stddev,
      q1,
      q3,
      iqr,
      movingAverage,
      sampleCount: values.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /** 기준선 설정 */
  setBaseline(source: string, stats: BaselineStats): void {
    this.baselines.set(source, stats);
    auditLog('baseline_updated', { source, sampleCount: stats.sampleCount });
  }

  /** 히스토리 데이터로 기준선 자동 학습 -- Design §6 */
  learnBaseline(source: string, historicalValues: number[]): BaselineStats {
    const stats = this.calculateBaseline(historicalValues);
    this.setBaseline(source, stats);
    return stats;
  }

  /** 기준선 조회 */
  getBaseline(source: string): BaselineStats | undefined {
    return this.baselines.get(source);
  }

  // -- 통계적 이상치 탐지 ────────────────────────────────────────────────

  /** Z-Score 탐지 -- Design §1 */
  detectByZScore(value: number, baseline: BaselineStats): boolean {
    if (baseline.stddev === 0) return false;
    const zScore = Math.abs(value - baseline.mean) / baseline.stddev;
    return zScore > this.config.zScoreThreshold;
  }

  /** IQR 탐지 -- Design §1 */
  detectByIQR(value: number, baseline: BaselineStats): boolean {
    if (baseline.iqr === 0) return false;
    const lowerBound = baseline.q1 - this.config.iqrMultiplier * baseline.iqr;
    const upperBound = baseline.q3 + this.config.iqrMultiplier * baseline.iqr;
    return value < lowerBound || value > upperBound;
  }

  /** 이동평균 편차 탐지 -- Design §1 */
  detectByMovingAverage(value: number, baseline: BaselineStats): boolean {
    if (baseline.movingAverage === 0) return false;
    const deviationRatio =
      Math.abs(value - baseline.movingAverage) / baseline.movingAverage;
    return deviationRatio > 0.5; // 50% 이상 편차
  }

  /** 투표 기반 종합 탐지 -- Design §1 */
  detect(point: MetricPoint): AnomalyResult | null {
    const source = point.source ?? 'default';
    const baseline = this.baselines.get(source);
    if (!baseline) return null;

    const votes: DetectionAlgorithm[] = [];

    if (this.detectByZScore(point.value, baseline)) votes.push('z_score');
    if (this.detectByIQR(point.value, baseline)) votes.push('iqr');
    if (this.detectByMovingAverage(point.value, baseline)) votes.push('moving_average');

    if (votes.length < this.config.voteThreshold) return null;

    const deviation = baseline.stddev > 0
      ? Math.abs(point.value - baseline.mean) / baseline.stddev
      : Math.abs(point.value - baseline.mean);

    const severity = this.classifySeverity(deviation, votes.length);
    const anomalyType = this.classifyType(point, deviation);

    const result: AnomalyResult = {
      id: generateId(),
      timestamp: point.timestamp,
      severity,
      type: anomalyType,
      source,
      value: point.value,
      baseline: baseline.mean,
      deviation,
      algorithms: votes,
      confidence: votes.length / 3,
      description: this.generateDescription(point, baseline, votes, severity),
      metadata: point.metadata,
    };

    auditLog('anomaly_detected', {
      id: result.id,
      severity: result.severity,
      type: result.type,
      source: result.source,
      confidence: result.confidence,
    });

    return result;
  }

  // -- 심각도/유형 분류 ───────────────────────────────────────────────────

  /** 심각도 분류 -- Design §4 */
  private classifySeverity(deviation: number, voteCount: number): AnomalySeverity {
    if (deviation > 5 && voteCount === 3) return 'critical';
    if (deviation > 4 || voteCount === 3) return 'high';
    if (deviation > 3) return 'medium';
    return 'low';
  }

  /** 이상 유형 분류 -- Design §4 */
  private classifyType(point: MetricPoint, deviation: number): AnomalyType {
    const label = point.label?.toLowerCase() ?? '';
    const source = point.source?.toLowerCase() ?? '';

    if (label.includes('auth') || label.includes('login') || source.includes('security')) {
      return deviation > 4 ? 'security_breach' : 'access_pattern';
    }
    if (label.includes('error') || label.includes('5xx')) return 'error_spike';
    if (label.includes('latency') || label.includes('response_time')) return 'performance_degradation';
    if (label.includes('traffic') || label.includes('bandwidth')) return 'data_exfiltration';
    if (label.includes('cpu') || label.includes('memory') || label.includes('disk')) return 'resource_exhaustion';
    if (label.includes('config') || label.includes('setting')) return 'configuration_drift';
    return 'unknown';
  }

  /** 설명 텍스트 생성 */
  private generateDescription(
    point: MetricPoint,
    baseline: BaselineStats,
    algorithms: DetectionAlgorithm[],
    severity: AnomalySeverity,
  ): string {
    const algoNames = algorithms.map((a) => {
      switch (a) {
        case 'z_score': return 'Z-Score';
        case 'iqr': return 'IQR';
        case 'moving_average': return '이동평균';
      }
    });
    return (
      `[${severity.toUpperCase()}] 이상 감지: ` +
      `값=${point.value.toFixed(2)}, 기준선=${baseline.mean.toFixed(2)}, ` +
      `편차=${((point.value - baseline.mean) / (baseline.stddev || 1)).toFixed(2)}σ. ` +
      `탐지 알고리즘: ${algoNames.join(', ')}`
    );
  }

  // -- 실시간 스트리밍 ────────────────────────────────────────────────────

  /** 이벤트 수집 -- Design §3 */
  ingest(point: MetricPoint): AnomalyResult | null {
    this.eventBuffer.push(point);

    // 버퍼 크기 제한
    if (this.eventBuffer.length > this.config.window.maxBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.config.window.maxBufferSize);
    }

    // 즉시 탐지 실행
    return this.detect(point);
  }

  /** 배치 분석 */
  analyzeBatch(points: MetricPoint[]): AnomalyResult[] {
    const results: AnomalyResult[] = [];
    for (const point of points) {
      const result = this.detect(point);
      if (result) results.push(result);
    }
    return results;
  }

  /** 윈도우 기반 집계 분석 -- Design §3 */
  analyzeWindow(): AnomalyResult[] {
    const now = Date.now();
    const windowStart = now - this.config.window.windowSize;

    const windowPoints = this.eventBuffer.filter(
      (p) => new Date(p.timestamp).getTime() >= windowStart,
    );

    if (windowPoints.length === 0) return [];

    // 소스별 집계
    const bySource = new Map<string, number[]>();
    for (const p of windowPoints) {
      const source = p.source ?? 'default';
      const values = bySource.get(source) ?? [];
      values.push(p.value);
      bySource.set(source, values);
    }

    const results: AnomalyResult[] = [];
    for (const [source, values] of bySource) {
      const aggregated: MetricPoint = {
        timestamp: new Date().toISOString(),
        value: calculateMean(values),
        source,
        label: `window_aggregate_${source}`,
      };
      const result = this.detect(aggregated);
      if (result) results.push(result);
    }

    return results;
  }

  /** 스트리밍 분석 시작 -- Design §3 */
  startStreaming(): void {
    if (this.windowTimer) return;

    this.windowTimer = setInterval(() => {
      const anomalies = this.analyzeWindow();
      for (const anomaly of anomalies) {
        this.handleAnomaly(anomaly);
      }
    }, this.config.window.slideInterval);

    auditLog('streaming_started', {
      windowSize: this.config.window.windowSize,
      slideInterval: this.config.window.slideInterval,
    });
  }

  /** 스트리밍 분석 중지 */
  stopStreaming(): void {
    if (this.windowTimer) {
      clearInterval(this.windowTimer);
      this.windowTimer = null;
    }
    if (this.baselineTimer) {
      clearInterval(this.baselineTimer);
      this.baselineTimer = null;
    }
  }

  // -- 알림 ──────────────────────────────────────────────────────────────

  /** 이상 콜백 등록 */
  onAnomaly(callback: (result: AnomalyResult) => void): void {
    this.onAnomalyCallbacks.push(callback);
  }

  /** 이상 처리 + 알림 -- Design §5 */
  private handleAnomaly(anomaly: AnomalyResult): void {
    // 심각도 필터
    if (
      SEVERITY_ORDER[anomaly.severity] <
      SEVERITY_ORDER[this.config.alert.minSeverity]
    ) {
      return;
    }

    // 쿨다운 확인
    const lastAlert = this.lastAlertTime.get(anomaly.source) ?? 0;
    if (Date.now() - lastAlert < this.config.alert.cooldownMs) return;

    this.lastAlertTime.set(anomaly.source, Date.now());

    // 콜백 실행
    for (const cb of this.onAnomalyCallbacks) {
      try {
        cb(anomaly);
      } catch (error) {
        auditLog('callback_error', {
          anomalyId: anomaly.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 웹훅 알림
    if (this.config.alert.enabled && this.config.alert.webhookUrl) {
      this.sendWebhookAlert(anomaly).catch((error) => {
        auditLog('webhook_error', {
          anomalyId: anomaly.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /** 웹훅 알림 전송 -- Design §5 */
  private async sendWebhookAlert(anomaly: AnomalyResult): Promise<void> {
    if (!this.config.alert.webhookUrl) return;

    await fetch(this.config.alert.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'anomaly_alert',
        anomaly: {
          id: anomaly.id,
          severity: anomaly.severity,
          type: anomaly.type,
          source: anomaly.source,
          description: anomaly.description,
          timestamp: anomaly.timestamp,
        },
      }),
    });

    auditLog('alert_sent', { anomalyId: anomaly.id, channel: 'webhook' });
  }

  // -- 정리 ──────────────────────────────────────────────────────────────

  /** 리소스 정리 */
  destroy(): void {
    this.stopStreaming();
    this.eventBuffer = [];
    this.baselines.clear();
    this.lastAlertTime.clear();
    this.onAnomalyCallbacks = [];
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let detectorInstance: AnomalyDetector | null = null;

export function getAnomalyDetector(
  config?: Partial<AnomalyDetectorConfig>,
): AnomalyDetector {
  if (!detectorInstance) {
    detectorInstance = new AnomalyDetector(config);
  }
  return detectorInstance;
}

export function resetAnomalyDetector(): void {
  detectorInstance?.destroy();
  detectorInstance = null;
}
