// LLM 관찰가능성 메트릭 수집기 — FR-ADV9.1, FR-ADV9.2, FR-ADV9.3, FR-ADV9.9
// Design Ref: SVC-AI-ADV-R9 DESIGN §1
// Plan SC: SC-1 (메트릭 수집)
// CSAP: D-06 감사 로깅, D-12 시스템 개발 보안

// ── 메트릭 타입 정의 ─────────────────────────────────────────────────────────

/** LLM 요청 메트릭 (단일 요청) */
export interface LLMRequestMetric {
  /** 요청 ID */
  requestId: string;
  /** 모델 ID */
  model: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 요청 유형 */
  method: 'chat' | 'stream' | 'embed';
  /** 상태 */
  status: 'success' | 'error';
  /** 에러 유형 (에러 시) */
  errorType?: 'timeout' | 'provider' | 'validation' | 'rate_limit' | 'internal';
  /** 전체 레이턴시 (ms) */
  durationMs: number;
  /** Time To First Token (ms, 스트리밍 시) */
  ttftMs?: number;
  /** 프롬프트 토큰 수 */
  promptTokens: number;
  /** 생성 토큰 수 */
  completionTokens: number;
  /** 캐시 히트 여부 */
  cacheHit: boolean;
  /** 기록 시각 */
  timestamp: number;
}

/** 집계된 메트릭 (기간별) */
export interface AggregatedMetrics {
  /** 기간 */
  period: string;
  /** 총 요청 수 */
  totalRequests: number;
  /** 성공 요청 수 */
  successCount: number;
  /** 에러 요청 수 */
  errorCount: number;
  /** 캐시 히트 수 */
  cacheHitCount: number;
  /** 총 토큰 수 */
  totalTokens: number;
  /** 평균 레이턴시 (ms) */
  avgDurationMs: number;
  /** P50 레이턴시 (ms) */
  p50DurationMs: number;
  /** P95 레이턴시 (ms) */
  p95DurationMs: number;
  /** P99 레이턴시 (ms) */
  p99DurationMs: number;
  /** 평균 TTFT (ms) */
  avgTtftMs: number;
  /** 에러율 */
  errorRate: number;
  /** 캐시 히트율 */
  cacheHitRate: number;
  /** 모델별 분포 */
  modelDistribution: Record<string, number>;
}

/** 히스토그램 버킷 */
interface HistogramBuckets {
  boundaries: number[];
  counts: number[];
  sum: number;
  count: number;
}

/** 알림 임계값 설정 */
export interface AlertThresholds {
  /** 에러율 임계값 (기본 0.1 = 10%) */
  maxErrorRate: number;
  /** P95 레이턴시 임계값 (ms, 기본 5000) */
  maxP95LatencyMs: number;
  /** TTFT 임계값 (ms, 기본 2000) */
  maxTtftMs: number;
  /** 최소 평가 샘플 수 (기본 10) */
  minSampleCount: number;
}

/** 알림 이벤트 */
export interface MetricAlert {
  type: 'error_rate' | 'latency' | 'ttft';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
}

// ── 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: AlertThresholds = {
  maxErrorRate: 0.1,
  maxP95LatencyMs: 5000,
  maxTtftMs: 2000,
  minSampleCount: 10,
};

/** 히스토그램 버킷 경계 (ms) */
const LATENCY_BUCKETS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000];
const TTFT_BUCKETS = [50, 100, 200, 500, 1000, 2000, 5000];

// ── LLM 메트릭 수집기 ───────────────────────────────────────────────────────

/**
 * LLM 관찰가능성 메트릭 수집기
 *
 * LLM 호출의 레이턴시, 토큰 사용량, 에러율, 캐시 히트율 등을 수집하고
 * Prometheus 텍스트 형식으로 노출합니다.
 *
 * 특징:
 * - 히스토그램 기반 레이턴시 분포 (P50/P95/P99)
 * - 모델별, 테넌트별, 시간대별 집계
 * - 품질 이상 감지 (임계값 기반 알림)
 * - Prometheus 텍스트 형식 노출
 */
export class LLMMetricsCollector {
  private readonly metrics: LLMRequestMetric[] = [];
  private readonly maxMetrics: number;
  private readonly thresholds: AlertThresholds;

  // 카운터 (누적)
  private requestCount = 0;
  private errorCount = 0;
  private cacheHitCount = 0;
  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;

  // 히스토그램
  private latencyHistogram: HistogramBuckets;
  private ttftHistogram: HistogramBuckets;

  // 게이지
  private activeStreams = 0;

  // 알림 콜백
  onAlert?: (alert: MetricAlert) => void;

  constructor(options?: { maxMetrics?: number; thresholds?: Partial<AlertThresholds> }) {
    this.maxMetrics = options?.maxMetrics ?? 10_000;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options?.thresholds };
    this.latencyHistogram = createHistogram(LATENCY_BUCKETS);
    this.ttftHistogram = createHistogram(TTFT_BUCKETS);
  }

  /**
   * LLM 요청 메트릭을 기록합니다 — FR-ADV9.1
   */
  record(metric: LLMRequestMetric): void {
    // 메트릭 저장 (순환 버퍼)
    if (this.metrics.length >= this.maxMetrics) {
      this.metrics.shift();
    }
    this.metrics.push(metric);

    // 카운터 갱신
    this.requestCount++;
    if (metric.status === 'error') this.errorCount++;
    if (metric.cacheHit) this.cacheHitCount++;
    this.totalPromptTokens += metric.promptTokens;
    this.totalCompletionTokens += metric.completionTokens;

    // 히스토그램 갱신
    addToHistogram(this.latencyHistogram, metric.durationMs);
    if (metric.ttftMs !== undefined) {
      addToHistogram(this.ttftHistogram, metric.ttftMs);
    }

    // 이상 감지 — FR-ADV9.9
    this.checkAlerts();
  }

  /** 활성 스트림 수 증가 */
  incrementActiveStreams(): void {
    this.activeStreams++;
  }

  /** 활성 스트림 수 감소 */
  decrementActiveStreams(): void {
    this.activeStreams = Math.max(0, this.activeStreams - 1);
  }

  /**
   * 기간별 집계 메트릭을 반환합니다 — FR-ADV9.2
   *
   * @param windowMs - 집계 윈도우 (ms, 기본 5분)
   */
  aggregate(windowMs: number = 300_000): AggregatedMetrics {
    const cutoff = Date.now() - windowMs;
    const windowMetrics = this.metrics.filter((m) => m.timestamp >= cutoff);

    if (windowMetrics.length === 0) {
      return emptyAggregation(windowMs);
    }

    const durations = windowMetrics.map((m) => m.durationMs).sort((a, b) => a - b);
    const ttfts = windowMetrics
      .filter((m) => m.ttftMs !== undefined)
      .map((m) => m.ttftMs!)
      .sort((a, b) => a - b);

    const successCount = windowMetrics.filter((m) => m.status === 'success').length;
    const errorCount = windowMetrics.filter((m) => m.status === 'error').length;
    const cacheHits = windowMetrics.filter((m) => m.cacheHit).length;
    const totalTokens = windowMetrics.reduce((s, m) => s + m.promptTokens + m.completionTokens, 0);

    const modelDist: Record<string, number> = {};
    for (const m of windowMetrics) {
      modelDist[m.model] = (modelDist[m.model] ?? 0) + 1;
    }

    return {
      period: `${windowMs / 1000}s`,
      totalRequests: windowMetrics.length,
      successCount,
      errorCount,
      cacheHitCount: cacheHits,
      totalTokens,
      avgDurationMs: Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
      p50DurationMs: percentile(durations, 50),
      p95DurationMs: percentile(durations, 95),
      p99DurationMs: percentile(durations, 99),
      avgTtftMs: ttfts.length > 0 ? Math.round(ttfts.reduce((s, t) => s + t, 0) / ttfts.length) : 0,
      errorRate: windowMetrics.length > 0 ? errorCount / windowMetrics.length : 0,
      cacheHitRate: windowMetrics.length > 0 ? cacheHits / windowMetrics.length : 0,
      modelDistribution: modelDist,
    };
  }

  /**
   * Prometheus 텍스트 형식으로 메트릭을 노출합니다 — FR-ADV9.3
   */
  toPrometheus(): string {
    const lines: string[] = [];

    // 요청 카운터
    lines.push('# HELP llm_request_total LLM 총 요청 수');
    lines.push('# TYPE llm_request_total counter');
    lines.push(`llm_request_total ${this.requestCount}`);

    // 에러 카운터
    lines.push('# HELP llm_error_total LLM 에러 수');
    lines.push('# TYPE llm_error_total counter');
    lines.push(`llm_error_total ${this.errorCount}`);

    // 캐시 히트 카운터
    lines.push('# HELP llm_cache_hit_total 캐시 히트 수');
    lines.push('# TYPE llm_cache_hit_total counter');
    lines.push(`llm_cache_hit_total ${this.cacheHitCount}`);

    // 토큰 카운터
    lines.push('# HELP llm_tokens_total 총 토큰 사용량');
    lines.push('# TYPE llm_tokens_total counter');
    lines.push(`llm_tokens_total{type="prompt"} ${this.totalPromptTokens}`);
    lines.push(`llm_tokens_total{type="completion"} ${this.totalCompletionTokens}`);

    // 레이턴시 히스토그램
    lines.push('# HELP llm_request_duration_ms LLM 요청 레이턴시');
    lines.push('# TYPE llm_request_duration_ms histogram');
    for (let i = 0; i < this.latencyHistogram.boundaries.length; i++) {
      const le = this.latencyHistogram.boundaries[i];
      const count = this.latencyHistogram.counts[i] ?? 0;
      lines.push(`llm_request_duration_ms_bucket{le="${le}"} ${count}`);
    }
    lines.push(`llm_request_duration_ms_bucket{le="+Inf"} ${this.latencyHistogram.count}`);
    lines.push(`llm_request_duration_ms_sum ${this.latencyHistogram.sum}`);
    lines.push(`llm_request_duration_ms_count ${this.latencyHistogram.count}`);

    // TTFT 히스토그램
    lines.push('# HELP llm_ttft_ms Time To First Token');
    lines.push('# TYPE llm_ttft_ms histogram');
    for (let i = 0; i < this.ttftHistogram.boundaries.length; i++) {
      const le = this.ttftHistogram.boundaries[i];
      const count = this.ttftHistogram.counts[i] ?? 0;
      lines.push(`llm_ttft_ms_bucket{le="${le}"} ${count}`);
    }
    lines.push(`llm_ttft_ms_bucket{le="+Inf"} ${this.ttftHistogram.count}`);
    lines.push(`llm_ttft_ms_sum ${this.ttftHistogram.sum}`);
    lines.push(`llm_ttft_ms_count ${this.ttftHistogram.count}`);

    // 활성 스트림 게이지
    lines.push('# HELP llm_active_streams 활성 스트리밍 세션 수');
    lines.push('# TYPE llm_active_streams gauge');
    lines.push(`llm_active_streams ${this.activeStreams}`);

    return lines.join('\n');
  }

  /** 메트릭 초기화 */
  reset(): void {
    this.metrics.length = 0;
    this.requestCount = 0;
    this.errorCount = 0;
    this.cacheHitCount = 0;
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.latencyHistogram = createHistogram(LATENCY_BUCKETS);
    this.ttftHistogram = createHistogram(TTFT_BUCKETS);
    this.activeStreams = 0;
  }

  // ── 내부: 이상 감지 — FR-ADV9.9 ───────────────────────────────────

  private checkAlerts(): void {
    if (this.requestCount < this.thresholds.minSampleCount) return;

    const now = Date.now();

    // 최근 5분 집계로 판단
    const agg = this.aggregate(300_000);

    // 에러율 알림
    if (agg.errorRate > this.thresholds.maxErrorRate) {
      this.onAlert?.({
        type: 'error_rate',
        severity: agg.errorRate > this.thresholds.maxErrorRate * 2 ? 'critical' : 'warning',
        message: `LLM 에러율 ${(agg.errorRate * 100).toFixed(1)}% (임계값: ${(this.thresholds.maxErrorRate * 100).toFixed(1)}%)`,
        currentValue: agg.errorRate,
        threshold: this.thresholds.maxErrorRate,
        timestamp: now,
      });
    }

    // P95 레이턴시 알림
    if (agg.p95DurationMs > this.thresholds.maxP95LatencyMs) {
      this.onAlert?.({
        type: 'latency',
        severity: agg.p95DurationMs > this.thresholds.maxP95LatencyMs * 2 ? 'critical' : 'warning',
        message: `LLM P95 레이턴시 ${agg.p95DurationMs}ms (임계값: ${this.thresholds.maxP95LatencyMs}ms)`,
        currentValue: agg.p95DurationMs,
        threshold: this.thresholds.maxP95LatencyMs,
        timestamp: now,
      });
    }

    // TTFT 알림
    if (agg.avgTtftMs > this.thresholds.maxTtftMs && agg.avgTtftMs > 0) {
      this.onAlert?.({
        type: 'ttft',
        severity: 'warning',
        message: `LLM 평균 TTFT ${agg.avgTtftMs}ms (임계값: ${this.thresholds.maxTtftMs}ms)`,
        currentValue: agg.avgTtftMs,
        threshold: this.thresholds.maxTtftMs,
        timestamp: now,
      });
    }
  }
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

function createHistogram(boundaries: number[]): HistogramBuckets {
  return {
    boundaries: [...boundaries],
    counts: new Array(boundaries.length).fill(0) as number[],
    sum: 0,
    count: 0,
  };
}

function addToHistogram(histogram: HistogramBuckets, value: number): void {
  histogram.sum += value;
  histogram.count++;
  for (let i = 0; i < histogram.boundaries.length; i++) {
    if (value <= (histogram.boundaries[i] ?? Infinity)) {
      histogram.counts[i] = (histogram.counts[i] ?? 0) + 1;
    }
  }
}

function percentile(sortedValues: number[], pct: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((pct / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)] ?? 0;
}

function emptyAggregation(windowMs: number): AggregatedMetrics {
  return {
    period: `${windowMs / 1000}s`,
    totalRequests: 0, successCount: 0, errorCount: 0, cacheHitCount: 0,
    totalTokens: 0, avgDurationMs: 0, p50DurationMs: 0, p95DurationMs: 0,
    p99DurationMs: 0, avgTtftMs: 0, errorRate: 0, cacheHitRate: 0,
    modelDistribution: {},
  };
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

/** LLM 메트릭 수집기 싱글톤 */
let defaultCollector: LLMMetricsCollector | null = null;

export function getLLMMetricsCollector(): LLMMetricsCollector {
  if (!defaultCollector) {
    defaultCollector = new LLMMetricsCollector();
  }
  return defaultCollector;
}

export function createLLMMetricsCollector(
  options?: { maxMetrics?: number; thresholds?: Partial<AlertThresholds> },
): LLMMetricsCollector {
  return new LLMMetricsCollector(options);
}
