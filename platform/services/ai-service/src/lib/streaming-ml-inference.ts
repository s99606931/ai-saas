// 스트리밍 ML 추론 파이프라인 — FR-N401.1~5

export interface StreamEvent<TInput = Record<string, unknown>> {
  id: string;
  timestamp: string;
  payload: TInput;
}

export interface InferenceOutput<TOutput = Record<string, unknown>> {
  eventId: string;
  result: TOutput;
  latencyMs: number;
}

export interface PipelineMetrics {
  processed: number;
  dropped: number;
  avgLatencyMs: number;
  throughputPerSec: number;
  queueLength: number;
}

export type InferenceFn<TIn, TOut> = (batch: TIn[]) => Promise<TOut[]>;

export interface PipelineOptions {
  batchSize: number;
  maxQueueSize: number;
  flushIntervalMs: number;
}

export class StreamingMlInferencePipeline<TIn = Record<string, unknown>, TOut = Record<string, unknown>> {
  private readonly queue: StreamEvent<TIn>[] = [];
  private readonly listeners: Array<(out: InferenceOutput<TOut>) => void> = [];
  private readonly latencyWindow: number[] = [];
  private processedCount = 0;
  private droppedCount = 0;
  private startedAt = Date.now();

  constructor(
    private readonly inferenceFn: InferenceFn<TIn, TOut>,
    private readonly options: PipelineOptions,
  ) {
    if (options.batchSize <= 0) throw new Error('PIPELINE_INVALID_BATCH');
    if (options.maxQueueSize <= 0) throw new Error('PIPELINE_INVALID_QUEUE');
  }

  enqueue(event: StreamEvent<TIn>): boolean {
    if (this.queue.length >= this.options.maxQueueSize) {
      this.droppedCount += 1;
      return false;
    }
    this.queue.push(event);
    return true;
  }

  onResult(listener: (out: InferenceOutput<TOut>) => void): void {
    this.listeners.push(listener);
  }

  async flush(): Promise<InferenceOutput<TOut>[]> {
    if (this.queue.length === 0) return [];
    const size = Math.min(this.options.batchSize, this.queue.length);
    const batch = this.queue.splice(0, size);
    const start = Date.now();
    const results = await this.inferenceFn(batch.map((e) => e.payload));
    const latency = Date.now() - start;
    if (results.length !== batch.length) {
      throw new Error('PIPELINE_RESULT_SIZE_MISMATCH');
    }
    const outputs: InferenceOutput<TOut>[] = batch.map((event, idx) => {
      const result = results[idx];
      if (result === undefined) throw new Error('PIPELINE_MISSING_RESULT');
      return { eventId: event.id, result, latencyMs: latency };
    });
    this.processedCount += outputs.length;
    this.latencyWindow.push(latency);
    if (this.latencyWindow.length > 100) this.latencyWindow.shift();
    for (const out of outputs) {
      for (const listener of this.listeners) listener(out);
    }
    return outputs;
  }

  metrics(): PipelineMetrics {
    const elapsed = (Date.now() - this.startedAt) / 1000;
    const avg =
      this.latencyWindow.length > 0
        ? this.latencyWindow.reduce((a, b) => a + b, 0) / this.latencyWindow.length
        : 0;
    return {
      processed: this.processedCount,
      dropped: this.droppedCount,
      avgLatencyMs: Number(avg.toFixed(2)),
      throughputPerSec: elapsed > 0 ? Number((this.processedCount / elapsed).toFixed(2)) : 0,
      queueLength: this.queue.length,
    };
  }

  reset(): void {
    this.queue.length = 0;
    this.processedCount = 0;
    this.droppedCount = 0;
    this.latencyWindow.length = 0;
    this.startedAt = Date.now();
  }
}
