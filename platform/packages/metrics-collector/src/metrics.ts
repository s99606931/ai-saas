// Metrics Collector -- Prometheus 호환 메트릭 수집
// Design Ref: SVC-METRICS-R35 DESIGN
// Plan SC: FR-MT.1~FR-MT.6
// CSAP: D-14 가용성 모니터링

export type Labels = Record<string, string>;

/**
 * 라벨 맵을 정규화된 키 문자열로 변환
 * Plan SC: FR-MT.4
 */
function labelKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  return keys.map((k) => `${k}="${escapeLabel(labels[k]!)}"`).join(',');
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * 기본 메트릭 추상 클래스
 */
abstract class Metric {
  constructor(
    public readonly name: string,
    public readonly help: string,
  ) {
    if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) {
      throw new Error(`유효하지 않은 메트릭 이름: ${name}`);
    }
  }

  abstract type(): 'counter' | 'gauge' | 'histogram';
  abstract export(): string;
}

/**
 * Counter -- 단조 증가 메트릭
 * Plan SC: FR-MT.1
 */
export class Counter extends Metric {
  private values = new Map<string, number>();

  type(): 'counter' {
    return 'counter';
  }

  inc(value = 1, labels: Labels = {}): void {
    if (value < 0) {
      throw new Error('Counter는 음수로 증가할 수 없습니다.');
    }
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  value(labels: Labels = {}): number {
    return this.values.get(labelKey(labels)) ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  export(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [key, val] of this.values) {
        lines.push(key ? `${this.name}{${key}} ${val}` : `${this.name} ${val}`);
      }
    }
    return lines.join('\n');
  }
}

/**
 * Gauge -- 증감 가능 메트릭
 * Plan SC: FR-MT.2
 */
export class Gauge extends Metric {
  private values = new Map<string, number>();

  type(): 'gauge' {
    return 'gauge';
  }

  set(value: number, labels: Labels = {}): void {
    this.values.set(labelKey(labels), value);
  }

  inc(value = 1, labels: Labels = {}): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  dec(value = 1, labels: Labels = {}): void {
    this.inc(-value, labels);
  }

  value(labels: Labels = {}): number {
    return this.values.get(labelKey(labels)) ?? 0;
  }

  export(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [key, val] of this.values) {
        lines.push(key ? `${this.name}{${key}} ${val}` : `${this.name} ${val}`);
      }
    }
    return lines.join('\n');
  }
}

/**
 * Histogram -- 버킷 분포 메트릭
 * Plan SC: FR-MT.3
 */
export class Histogram extends Metric {
  private readonly buckets: number[];
  private readonly bucketCounts = new Map<string, number[]>();
  private readonly sums = new Map<string, number>();
  private readonly counts = new Map<string, number>();

  constructor(
    name: string,
    help: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ) {
    super(name, help);
    if (buckets.length === 0) {
      throw new Error('버킷은 최소 1개 이상이어야 합니다.');
    }
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  type(): 'histogram' {
    return 'histogram';
  }

  observe(value: number, labels: Labels = {}): void {
    const key = labelKey(labels);
    let bc = this.bucketCounts.get(key);
    if (!bc) {
      bc = new Array(this.buckets.length).fill(0);
      this.bucketCounts.set(key, bc);
    }
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]!) {
        bc[i]!++;
      }
    }
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  sum(labels: Labels = {}): number {
    return this.sums.get(labelKey(labels)) ?? 0;
  }

  count(labels: Labels = {}): number {
    return this.counts.get(labelKey(labels)) ?? 0;
  }

  export(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    const keys = this.bucketCounts.size > 0 ? Array.from(this.bucketCounts.keys()) : [''];
    for (const key of keys) {
      const bc = this.bucketCounts.get(key) ?? new Array(this.buckets.length).fill(0);
      const baseLabels = key ? `${key},` : '';
      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(`${this.name}_bucket{${baseLabels}le="${this.buckets[i]}"} ${bc[i]}`);
      }
      lines.push(
        `${this.name}_bucket{${baseLabels}le="+Inf"} ${this.counts.get(key) ?? 0}`,
      );
      const sumPrefix = key ? `{${key}}` : '';
      lines.push(`${this.name}_sum${sumPrefix} ${this.sums.get(key) ?? 0}`);
      lines.push(`${this.name}_count${sumPrefix} ${this.counts.get(key) ?? 0}`);
    }
    return lines.join('\n');
  }
}

/**
 * MetricsRegistry -- 메트릭 통합 관리
 * Plan SC: FR-MT.5, FR-MT.6
 */
export class MetricsRegistry {
  private readonly metrics = new Map<string, Metric>();

  register<T extends Metric>(metric: T): T {
    if (this.metrics.has(metric.name)) {
      throw new Error(`이미 등록된 메트릭: ${metric.name}`);
    }
    this.metrics.set(metric.name, metric);
    return metric;
  }

  get(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  unregister(name: string): boolean {
    return this.metrics.delete(name);
  }

  clear(): void {
    this.metrics.clear();
  }

  size(): number {
    return this.metrics.size;
  }

  /**
   * Prometheus 텍스트 포맷 0.0.4
   * Plan SC: FR-MT.5
   */
  exportPrometheus(): string {
    const parts: string[] = [];
    for (const metric of this.metrics.values()) {
      parts.push(metric.export());
    }
    return parts.join('\n\n') + '\n';
  }
}
