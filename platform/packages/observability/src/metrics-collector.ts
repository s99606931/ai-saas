// Prometheus 호환 메트릭 수집기
// Design Ref: SVC-OBSERVE-R15 Plan
// Plan SC: FR-OBS.3
// CSAP: D-06 침해사고 관리

/**
 * 메트릭 유형
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * 메트릭 레이블
 */
export type MetricLabels = Record<string, string>;

/**
 * 메트릭 정의
 */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  labels: string[];
}

/**
 * 히스토그램 버킷 기본값 (초 단위)
 */
const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * 카운터 메트릭
 */
export class Counter {
  readonly name: string;
  readonly help: string;
  private readonly values = new Map<string, number>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels: MetricLabels = {}, value = 1): void {
    const key = this.labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  get(labels: MetricLabels = {}): number {
    return this.values.get(this.labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  /** Prometheus 텍스트 형식 출력 */
  serialize(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} counter`);

    for (const [key, value] of this.values) {
      const labelStr = key ? `{${key}}` : '';
      lines.push(`${this.name}${labelStr} ${value}`);
    }

    return lines.join('\n');
  }

  private labelsKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

/**
 * 게이지 메트릭
 */
export class Gauge {
  readonly name: string;
  readonly help: string;
  private readonly values = new Map<string, number>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  set(labels: MetricLabels, value: number): void {
    this.values.set(this.labelsKey(labels), value);
  }

  inc(labels: MetricLabels = {}, value = 1): void {
    const key = this.labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  dec(labels: MetricLabels = {}, value = 1): void {
    const key = this.labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - value);
  }

  get(labels: MetricLabels = {}): number {
    return this.values.get(this.labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  serialize(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} gauge`);

    for (const [key, value] of this.values) {
      const labelStr = key ? `{${key}}` : '';
      lines.push(`${this.name}${labelStr} ${value}`);
    }

    return lines.join('\n');
  }

  private labelsKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

/**
 * 히스토그램 메트릭
 */
export class Histogram {
  readonly name: string;
  readonly help: string;
  private readonly buckets: number[];
  private readonly bucketCounts = new Map<string, Map<number, number>>();
  private readonly sums = new Map<string, number>();
  private readonly counts = new Map<string, number>();

  constructor(name: string, help: string, buckets?: number[]) {
    this.name = name;
    this.help = help;
    this.buckets = buckets ?? DEFAULT_BUCKETS;
  }

  observe(labels: MetricLabels, value: number): void {
    const key = this.labelsKey(labels);

    // 카운트 업데이트
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);

    // 버킷 업데이트
    if (!this.bucketCounts.has(key)) {
      this.bucketCounts.set(key, new Map());
    }
    const bucketMap = this.bucketCounts.get(key)!;
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);
      }
    }
  }

  getCount(labels: MetricLabels = {}): number {
    return this.counts.get(this.labelsKey(labels)) ?? 0;
  }

  getSum(labels: MetricLabels = {}): number {
    return this.sums.get(this.labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this.bucketCounts.clear();
    this.sums.clear();
    this.counts.clear();
  }

  serialize(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} histogram`);

    for (const [key, count] of this.counts) {
      const labelStr = key ? `,${key}` : '';
      const bucketMap = this.bucketCounts.get(key) ?? new Map();

      let cumulative = 0;
      for (const bucket of this.buckets) {
        cumulative += bucketMap.get(bucket) ?? 0;
        lines.push(`${this.name}_bucket{le="${bucket}"${labelStr}} ${cumulative}`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"${labelStr}} ${count}`);
      lines.push(`${this.name}_sum{${key}} ${this.sums.get(key) ?? 0}`);
      lines.push(`${this.name}_count{${key}} ${count}`);
    }

    return lines.join('\n');
  }

  private labelsKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

/**
 * 메트릭 수집기 (레지스트리)
 *
 * 모든 메트릭을 중앙 관리하고 Prometheus 텍스트 형식으로 노출합니다.
 */
export class MetricsCollector {
  private readonly serviceName: string;
  private readonly counters = new Map<string, Counter>();
  private readonly gauges = new Map<string, Gauge>();
  private readonly histograms = new Map<string, Histogram>();

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * 카운터 생성 또는 반환
   */
  counter(name: string, help: string): Counter {
    const fullName = `${this.serviceName}_${name}`;
    if (!this.counters.has(fullName)) {
      this.counters.set(fullName, new Counter(fullName, help));
    }
    return this.counters.get(fullName)!;
  }

  /**
   * 게이지 생성 또는 반환
   */
  gauge(name: string, help: string): Gauge {
    const fullName = `${this.serviceName}_${name}`;
    if (!this.gauges.has(fullName)) {
      this.gauges.set(fullName, new Gauge(fullName, help));
    }
    return this.gauges.get(fullName)!;
  }

  /**
   * 히스토그램 생성 또는 반환
   */
  histogram(name: string, help: string, buckets?: number[]): Histogram {
    const fullName = `${this.serviceName}_${name}`;
    if (!this.histograms.has(fullName)) {
      this.histograms.set(fullName, new Histogram(fullName, help, buckets));
    }
    return this.histograms.get(fullName)!;
  }

  /**
   * 전체 메트릭 Prometheus 텍스트 형식 출력
   */
  serialize(): string {
    const parts: string[] = [];

    for (const counter of this.counters.values()) {
      parts.push(counter.serialize());
    }
    for (const gauge of this.gauges.values()) {
      parts.push(gauge.serialize());
    }
    for (const histogram of this.histograms.values()) {
      parts.push(histogram.serialize());
    }

    return parts.join('\n\n') + '\n';
  }

  /**
   * 등록된 메트릭 수
   */
  getMetricCount(): number {
    return this.counters.size + this.gauges.size + this.histograms.size;
  }

  /**
   * 전체 메트릭 초기화 (테스트용)
   */
  reset(): void {
    for (const c of this.counters.values()) c.reset();
    for (const g of this.gauges.values()) g.reset();
    for (const h of this.histograms.values()) h.reset();
  }
}
