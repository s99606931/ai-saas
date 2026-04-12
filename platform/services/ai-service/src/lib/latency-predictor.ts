// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R85.design.md
// Plan SC: FR-R85.1~5 (SVC-AI-ADV-R85 Latency Predictor)
// CSAP: D-06 감사 로그

export interface Observation {
  latencyMs: number;
  qps: number;
  ts: number;
}

export interface PredictOptions {
  targetQps: number;
  slaThresholdMs?: number;
}

export interface PredictResult {
  p50: number;
  p95: number;
  p99: number;
  predicted: number;
  loadFactor: number;
  slaViolationLikely: boolean;
}

export interface AuditEvent {
  ts: string;
  action: 'OBSERVE' | 'PREDICT' | 'WARN' | 'CLEAR';
  details: Record<string, unknown>;
}

export class LatencyPredictor {
  private readonly buffer: Observation[] = [];
  private readonly capacity: number;
  private readonly auditLog: AuditEvent[] = [];

  constructor(capacity = 500) {
    if (capacity < 10) throw new Error('capacity must be >= 10');
    this.capacity = capacity;
  }

  /** FR-R85.1 */
  observe(latencyMs: number, qps = 1): void {
    if (latencyMs < 0 || qps < 0) throw new Error('invalid observation');
    this.buffer.push({ latencyMs, qps, ts: Date.now() });
    if (this.buffer.length > this.capacity) this.buffer.shift();
    this.log('OBSERVE', { latencyMs, qps, size: this.buffer.length });
  }

  /** FR-R85.2 */
  percentile(p: number): number {
    if (this.buffer.length === 0) return 0;
    if (p <= 0 || p >= 1) throw new Error('p must be in (0,1)');
    const sorted = this.buffer.map((o) => o.latencyMs).sort((a, b) => a - b);
    const rank = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
    return sorted[Math.max(0, rank)] ?? 0;
  }

  /** FR-R85.3~4 */
  predictWithLoad(opts: PredictOptions): PredictResult {
    const p50 = this.percentile(0.5);
    const p95 = this.percentile(0.95);
    const p99 = this.percentile(0.99);

    const avgQps =
      this.buffer.length > 0
        ? this.buffer.reduce((s, o) => s + o.qps, 0) / this.buffer.length
        : 1;

    const loadFactor = Math.max(1, opts.targetQps / Math.max(0.001, avgQps));
    const boosted = Math.min(Math.pow(loadFactor, 1.3), 3.0);
    const predicted = p95 * boosted;

    const slaThreshold = opts.slaThresholdMs ?? Number.POSITIVE_INFINITY;
    const slaViolationLikely = predicted > slaThreshold;

    this.log('PREDICT', {
      p50,
      p95,
      p99,
      loadFactor: Number(loadFactor.toFixed(3)),
      predicted: Number(predicted.toFixed(1)),
    });

    if (slaViolationLikely) {
      this.log('WARN', {
        predicted: Number(predicted.toFixed(1)),
        slaThreshold,
      });
    }

    return { p50, p95, p99, predicted, loadFactor, slaViolationLikely };
  }

  clear(): void {
    this.buffer.length = 0;
    this.log('CLEAR', {});
  }

  size(): number {
    return this.buffer.length;
  }

  /** FR-R85.5 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private log(action: AuditEvent['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ ts: new Date().toISOString(), action, details });
  }
}

export function createLatencyPredictor(capacity?: number): LatencyPredictor {
  return new LatencyPredictor(capacity);
}
