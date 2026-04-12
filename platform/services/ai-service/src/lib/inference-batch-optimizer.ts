// SVC-AI-ADV-R351 Inference Batch Optimizer
// Design Ref: SVC-AI-ADV-R351.design.md
// Plan SC: SC-R351-1~4
// CSAP: D-06 감사, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface BatchRequest<T> {
  readonly id: string;
  readonly modelId: string;
  readonly payload: T;
  readonly grade: DataGrade;
  readonly queuedAt: number;
}

export interface BatchFlushResult {
  readonly modelId: string;
  readonly size: number;
  readonly flushedAt: string;
  readonly reason: 'size' | 'timeout' | 'manual';
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export interface BatchConfig {
  readonly maxBatchSize: number;
  readonly timeoutMs: number;
}

export type BatchExecutor<T> = (batch: readonly BatchRequest<T>[]) => void;

export class InferenceBatchOptimizer<T> {
  private readonly queues = new Map<string, BatchRequest<T>[]>();
  private readonly configs = new Map<string, BatchConfig>();
  private readonly auditLog: AuditEntry[] = [];

  constructor(private readonly executor: BatchExecutor<T>) {}

  configureModel(modelId: string, config: BatchConfig): void {
    this.configs.set(modelId, config);
    this.record('CONFIGURE', modelId, { ...config });
  }

  enqueue(req: BatchRequest<T>): BatchFlushResult | null {
    if (req.grade === 'C' || req.grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${req.grade}등급 요청 처리 금지 (N2SF N-05)`);
    }
    const queue = this.queues.get(req.modelId) ?? [];
    queue.push(req);
    this.queues.set(req.modelId, queue);
    this.record('ENQUEUE', req.id, { modelId: req.modelId });

    const config = this.configs.get(req.modelId);
    if (config && queue.length >= config.maxBatchSize) {
      return this.flush(req.modelId, 'size');
    }
    return null;
  }

  tick(now: number): readonly BatchFlushResult[] {
    const results: BatchFlushResult[] = [];
    for (const [modelId, queue] of this.queues.entries()) {
      if (queue.length === 0) continue;
      const config = this.configs.get(modelId);
      if (!config) continue;
      const head = queue[0];
      if (!head) continue;
      if (now - head.queuedAt >= config.timeoutMs) {
        const res = this.flush(modelId, 'timeout');
        if (res) results.push(res);
      }
    }
    return results;
  }

  flush(modelId: string, reason: 'size' | 'timeout' | 'manual' = 'manual'): BatchFlushResult | null {
    const queue = this.queues.get(modelId);
    if (!queue || queue.length === 0) return null;
    const batch = queue.splice(0, queue.length);
    this.executor(batch);
    const result: BatchFlushResult = {
      modelId,
      size: batch.length,
      flushedAt: new Date().toISOString(),
      reason,
    };
    this.record('FLUSH', modelId, { size: batch.length, reason });
    return result;
  }

  getQueueSize(modelId: string): number {
    return this.queues.get(modelId)?.length ?? 0;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
