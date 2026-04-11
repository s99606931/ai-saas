// 공공데이터 실시간 스트리밍 파이프라인 -- FR-N256.1~FR-N256.7
// Design Ref: MTU-N256 DESIGN §1~§7
// Plan SC: SC-1 (초당 1,000건), SC-2 (지연 <100ms), SC-3 (PII 100%), SC-4 (테넌트 격리 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-10 네트워크 보안, D-12 개발 보안

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** N2SF 데이터 등급 */
type DataGrade = 'O';

/** 스트림 이벤트 -- Design §1 */
export interface StreamEvent<T = unknown> {
  id: string;
  timestamp: string;
  tenantId: string;
  source: string;
  data: T;
  metadata: Record<string, string>;
  grade: DataGrade;
}

/** 파이프라인 설정 -- Design §1 */
export interface StreamConfig {
  pipelineId: string;
  tenantId: string;
  batchSize: number;
  batchTimeoutMs: number;
  maxBufferSize: number;
  maxRetries: number;
  retryDelayMs: number;
}

/** 파이프라인 상태 */
export type PipelineState = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

/** DLQ 항목 -- Design §5 */
export interface DeadLetterItem {
  event: StreamEvent;
  error: string;
  attempts: number;
  firstFailedAt: string;
  lastFailedAt: string;
}

/** 메트릭 스냅샷 -- Design §6 */
export interface PipelineMetrics {
  pipelineId: string;
  tenantId: string;
  eventsReceived: number;
  eventsProcessed: number;
  eventsFailed: number;
  eventsFiltered: number;
  averageLatencyMs: number;
  p99LatencyMs: number;
  bufferSize: number;
  dlqSize: number;
  uptime: number;
  state: PipelineState;
}

// -- 소스 커넥터 인터페이스 -- Design §2 ──────────────────────────────────────

/** 소스 커넥터 공통 인터페이스 */
export interface SourceConnector {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  on(event: 'data', handler: (evt: StreamEvent) => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
}

// -- 변환 함수 타입 -- Design §3 ─────────────────────────────────────────────

/** 변환 함수: null 반환 = 필터링(제거) */
export type TransformFn<I = unknown, O = unknown> = (
  event: StreamEvent<I>,
) => StreamEvent<O> | null;

// -- 싱크 커넥터 인터페이스 -- Design §4 ──────────────────────────────────────

/** 싱크 커넥터 공통 인터페이스 */
export interface SinkConnector {
  readonly name: string;
  write(events: StreamEvent[]): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
}

// -- 내장 소스 커넥터 ─────────────────────────────────────────────────────────

/** HTTP 폴링 소스 -- Design §2.1 */
export class HttpPollingSource extends EventEmitter implements SourceConnector {
  readonly name: string;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private paused = false;

  constructor(
    private readonly config: {
      url: string;
      intervalMs: number;
      tenantId: string;
      headers?: Record<string, string>;
      transform?: (data: unknown) => unknown[];
    },
  ) {
    super();
    this.name = `http-polling:${config.url}`;
  }

  async start(): Promise<void> {
    this.intervalHandle = setInterval(() => {
      if (this.paused) return;
      this.poll().catch((err) => this.emit('error', err));
    }, this.config.intervalMs);
    // 즉시 첫 폴링
    await this.poll();
  }

  async stop(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(this.config.url, {
        headers: {
          'Accept': 'application/json',
          ...this.config.headers,
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      const items = this.config.transform ? this.config.transform(rawData) : [rawData];

      for (const item of items) {
        const event: StreamEvent = {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          tenantId: this.config.tenantId,
          source: this.name,
          data: item,
          metadata: { sourceType: 'http-polling' },
          grade: 'O',
        };
        this.emit('data', event);
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/** WebSocket 소스 -- Design §2.2 */
export class WebSocketSource extends EventEmitter implements SourceConnector {
  readonly name: string;
  private paused = false;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageHandler: ((data: unknown) => void) | null = null;

  constructor(
    private readonly config: {
      url: string;
      tenantId: string;
      reconnectIntervalMs?: number;
      protocols?: string[];
    },
  ) {
    super();
    this.name = `websocket:${config.url}`;
  }

  async start(): Promise<void> {
    // WebSocket 연결 시뮬레이션 (실제 환경에서는 ws 라이브러리 사용)
    this.connected = true;
    this.messageHandler = (data: unknown) => {
      if (this.paused) return;
      const event: StreamEvent = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: this.config.tenantId,
        source: this.name,
        data,
        metadata: { sourceType: 'websocket' },
        grade: 'O',
      };
      this.emit('data', event);
    };
  }

  async stop(): Promise<void> {
    this.connected = false;
    this.messageHandler = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** 외부에서 메시지를 주입 (테스트/통합용) */
  injectMessage(data: unknown): void {
    if (this.messageHandler && this.connected) {
      this.messageHandler(data);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/** 파일 감시 소스 -- Design §2.3 */
export class FileWatchSource extends EventEmitter implements SourceConnector {
  readonly name: string;
  private paused = false;
  private watching = false;

  constructor(
    private readonly config: {
      directory: string;
      tenantId: string;
      pattern?: string;
      pollIntervalMs?: number;
    },
  ) {
    super();
    this.name = `file-watch:${config.directory}`;
  }

  async start(): Promise<void> {
    this.watching = true;
    // 파일 감시 로직: 실제 환경에서는 fs.watch 또는 chokidar 사용
    // 여기서는 인터페이스만 제공
  }

  async stop(): Promise<void> {
    this.watching = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** 파일 이벤트 주입 (테스트/통합용) */
  injectFileEvent(filePath: string, content: unknown): void {
    if (!this.watching || this.paused) return;
    const event: StreamEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      tenantId: this.config.tenantId,
      source: this.name,
      data: { filePath, content },
      metadata: { sourceType: 'file-watch' },
      grade: 'O',
    };
    this.emit('data', event);
  }

  isWatching(): boolean {
    return this.watching;
  }
}

// -- 내장 변환기 -- Design §3 ────────────────────────────────────────────────

/** 조건 필터 변환 */
export function filterTransform<T>(predicate: (data: T) => boolean): TransformFn<T, T> {
  return (event: StreamEvent<T>) => {
    return predicate(event.data) ? event : null;
  };
}

/** 데이터 매핑 변환 */
export function mapTransform<I, O>(mapper: (data: I) => O): TransformFn<I, O> {
  return (event: StreamEvent<I>) => ({
    ...event,
    data: mapper(event.data),
  });
}

/** PII 마스킹 변환 -- N2SF 필수, CSAP D-08 */
export function piiMaskTransform(): TransformFn {
  const piiPatterns: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /\d{6}-[1-4]\d{6}/g, replacement: '******-*******' },          // 주민등록번호
    { pattern: /\d{3}-\d{2}-\d{5}/g, replacement: '***-**-*****' },           // 사업자등록번호
    { pattern: /01[016789]-\d{3,4}-\d{4}/g, replacement: '010-****-****' },   // 휴대전화
    { pattern: /[\w.-]+@[\w.-]+\.\w+/g, replacement: '***@***.***' },         // 이메일
    { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, replacement: '***.***.***.***' }, // IP
  ];

  return (event: StreamEvent) => {
    let dataStr = JSON.stringify(event.data);
    for (const { pattern, replacement } of piiPatterns) {
      dataStr = dataStr.replace(pattern, replacement);
    }
    return {
      ...event,
      data: JSON.parse(dataStr),
      metadata: { ...event.metadata, piiMasked: 'true' },
    };
  };
}

/** 데이터 등급 검증 변환 -- N2SF, CSAP D-08 */
export function gradeCheckTransform(): TransformFn {
  return (event: StreamEvent) => {
    // Design §7: O등급만 허용, C/S등급 차단
    if (event.grade !== 'O') {
      return null; // 차단: C/S등급 데이터는 파이프라인에 진입 불가
    }
    return event;
  };
}

/** 시간 윈도우 집계 변환 -- Design §3.3 */
export class AggregateTransform<T> {
  private window: StreamEvent<T>[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly windowMs: number,
    private readonly aggregator: (events: StreamEvent<T>[]) => StreamEvent,
  ) {}

  process(event: StreamEvent<T>): StreamEvent | null {
    this.window.push(event);

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.windowMs);
    }

    return null; // 집계 중에는 개별 이벤트 통과 안 함
  }

  flush(): StreamEvent | null {
    if (this.window.length === 0) return null;
    const result = this.aggregator(this.window);
    this.window = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return result;
  }

  getWindowSize(): number {
    return this.window.length;
  }
}

// -- 내장 싱크 커넥터 ────────────────────────────────────────────────────────

/** 이벤트 버스 싱크 -- Design §4.2 */
export class EventBusSink implements SinkConnector {
  readonly name = 'event-bus-sink';
  private buffer: StreamEvent[] = [];

  constructor(
    private readonly config: {
      channel: string;
      publishFn?: (channel: string, events: StreamEvent[]) => Promise<void>;
    },
  ) {}

  async write(events: StreamEvent[]): Promise<void> {
    // CSAP D-08: 테넌트 격리 검증
    for (const event of events) {
      if (!event.tenantId) {
        throw new Error('[SECURITY] 테넌트 ID가 없는 이벤트 감지 — 차단');
      }
    }

    if (this.config.publishFn) {
      await this.config.publishFn(this.config.channel, events);
    } else {
      this.buffer.push(...events);
    }
  }

  async flush(): Promise<void> {
    // 버퍼 비우기
    this.buffer = [];
  }

  async close(): Promise<void> {
    await this.flush();
  }

  getBuffer(): StreamEvent[] {
    return [...this.buffer];
  }
}

/** 파일 싱크 -- Design §4.3 */
export class FileSink implements SinkConnector {
  readonly name = 'file-sink';
  private records: StreamEvent[] = [];

  constructor(
    private readonly config: {
      outputPath: string;
      format: 'json' | 'csv';
      maxFileSize?: number;
      writeFn?: (path: string, data: string) => Promise<void>;
    },
  ) {}

  async write(events: StreamEvent[]): Promise<void> {
    this.records.push(...events);

    if (this.config.writeFn && this.records.length >= 100) {
      await this.flushToFile();
    }
  }

  async flush(): Promise<void> {
    if (this.records.length > 0 && this.config.writeFn) {
      await this.flushToFile();
    }
  }

  async close(): Promise<void> {
    await this.flush();
  }

  private async flushToFile(): Promise<void> {
    if (!this.config.writeFn) return;
    const data =
      this.config.format === 'json'
        ? JSON.stringify(this.records, null, 2)
        : this.records.map((r) => JSON.stringify(r.data)).join('\n');
    await this.config.writeFn(this.config.outputPath, data);
    this.records = [];
  }

  getRecords(): StreamEvent[] {
    return [...this.records];
  }
}

/** 벡터 스토어 싱크 -- Design §4.1 */
export class VectorStoreSink implements SinkConnector {
  readonly name = 'vector-store-sink';
  private ingested: StreamEvent[] = [];

  constructor(
    private readonly config: {
      collection: string;
      embedFn?: (text: string) => Promise<number[]>;
      upsertFn?: (id: string, vector: number[], metadata: Record<string, unknown>) => Promise<void>;
    },
  ) {}

  async write(events: StreamEvent[]): Promise<void> {
    for (const event of events) {
      if (this.config.embedFn && this.config.upsertFn) {
        const text = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        const vector = await this.config.embedFn(text);
        await this.config.upsertFn(event.id, vector, {
          tenantId: event.tenantId,
          source: event.source,
          timestamp: event.timestamp,
        });
      }
      this.ingested.push(event);
    }
  }

  async flush(): Promise<void> {
    // 벡터 스토어는 즉시 적재
  }

  async close(): Promise<void> {
    await this.flush();
  }

  getIngested(): StreamEvent[] {
    return [...this.ingested];
  }
}

// -- Dead Letter Queue -- Design §5 ──────────────────────────────────────────

/** Dead Letter Queue */
export class DeadLetterQueue {
  private queue: DeadLetterItem[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  /** 실패 이벤트 추가 */
  enqueue(event: StreamEvent, error: string): void {
    const existing = this.queue.find((item) => item.event.id === event.id);
    if (existing) {
      existing.attempts += 1;
      existing.lastFailedAt = new Date().toISOString();
      existing.error = error;
      return;
    }

    if (this.queue.length >= this.maxSize) {
      // 가장 오래된 항목 제거 (FIFO)
      this.queue.shift();
    }

    this.queue.push({
      event,
      error,
      attempts: 1,
      firstFailedAt: new Date().toISOString(),
      lastFailedAt: new Date().toISOString(),
    });
  }

  /** 재시도 가능한 항목 조회 */
  getRetryable(maxRetries: number): DeadLetterItem[] {
    return this.queue.filter((item) => item.attempts <= maxRetries);
  }

  /** 영구 실패 항목 조회 */
  getPermanentlyFailed(maxRetries: number): DeadLetterItem[] {
    return this.queue.filter((item) => item.attempts > maxRetries);
  }

  /** 항목 제거 (재처리 성공 시) */
  remove(eventId: string): boolean {
    const index = this.queue.findIndex((item) => item.event.id === eventId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /** DLQ 크기 */
  size(): number {
    return this.queue.length;
  }

  /** 전체 항목 조회 */
  getAll(): DeadLetterItem[] {
    return [...this.queue];
  }

  /** DLQ 비우기 */
  clear(): void {
    this.queue = [];
  }
}

// -- 스트림 프로세서 (메인 파이프라인) -- Design §1 ───────────────────────────

/** 스트림 프로세서: 소스 → 변환 → 싱크 완전 파이프라인 */
export class StreamProcessor extends EventEmitter {
  private state: PipelineState = 'idle';
  private source: SourceConnector | null = null;
  private transforms: TransformFn[] = [];
  private sinks: SinkConnector[] = [];
  private dlq: DeadLetterQueue;
  private buffer: StreamEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt: number = 0;

  // 메트릭 -- Design §6
  private metricsData = {
    eventsReceived: 0,
    eventsProcessed: 0,
    eventsFailed: 0,
    eventsFiltered: 0,
    latencies: [] as number[],
  };

  constructor(private readonly config: StreamConfig) {
    super();
    this.dlq = new DeadLetterQueue();
  }

  /** 소스 커넥터 설정 -- Design §2 */
  setSource(source: SourceConnector): this {
    this.source = source;
    return this;
  }

  /** 변환 함수 추가 (체이닝) -- Design §3 */
  addTransform(transform: TransformFn): this {
    this.transforms.push(transform);
    return this;
  }

  /** 싱크 커넥터 추가 -- Design §4 */
  addSink(sink: SinkConnector): this {
    this.sinks.push(sink);
    return this;
  }

  /** 파이프라인 시작 */
  async start(): Promise<void> {
    if (!this.source) {
      throw new Error('소스 커넥터가 설정되지 않았습니다');
    }
    if (this.sinks.length === 0) {
      throw new Error('싱크 커넥터가 하나 이상 필요합니다');
    }

    this.state = 'running';
    this.startedAt = Date.now();

    // 소스 이벤트 수신
    this.source.on('data', (event: StreamEvent) => {
      this.onEvent(event);
    });

    this.source.on('error', (err: Error) => {
      this.metricsData.eventsFailed += 1;
      this.emit('error', err);
    });

    // 배치 타이머 설정
    this.startBatchTimer();

    await this.source.start();
    this.emit('started', { pipelineId: this.config.pipelineId });
  }

  /** 파이프라인 정지 */
  async stop(): Promise<void> {
    this.state = 'stopped';

    // 잔여 버퍼 플러시
    await this.flushBuffer();

    // 배치 타이머 정리
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // 소스/싱크 정리
    if (this.source) {
      await this.source.stop();
    }
    for (const sink of this.sinks) {
      await sink.close();
    }

    this.emit('stopped', { pipelineId: this.config.pipelineId });
  }

  /** 파이프라인 일시 정지 (백프레셔) */
  pause(): void {
    this.state = 'paused';
    this.source?.pause();
    this.emit('paused', { pipelineId: this.config.pipelineId });
  }

  /** 파이프라인 재개 */
  resume(): void {
    this.state = 'running';
    this.source?.resume();
    this.startBatchTimer();
    this.emit('resumed', { pipelineId: this.config.pipelineId });
  }

  /** 현재 상태 조회 */
  getState(): PipelineState {
    return this.state;
  }

  /** 메트릭 스냅샷 -- Design §6 */
  getMetrics(): PipelineMetrics {
    const latencies = this.metricsData.latencies;
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
    const p99Latency = latencies.length > 0
      ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)] || 0
      : 0;

    return {
      pipelineId: this.config.pipelineId,
      tenantId: this.config.tenantId,
      eventsReceived: this.metricsData.eventsReceived,
      eventsProcessed: this.metricsData.eventsProcessed,
      eventsFailed: this.metricsData.eventsFailed,
      eventsFiltered: this.metricsData.eventsFiltered,
      averageLatencyMs: Math.round(avgLatency * 100) / 100,
      p99LatencyMs: Math.round(p99Latency * 100) / 100,
      bufferSize: this.buffer.length,
      dlqSize: this.dlq.size(),
      uptime: this.startedAt > 0 ? Date.now() - this.startedAt : 0,
      state: this.state,
    };
  }

  /** DLQ 접근 */
  getDlq(): DeadLetterQueue {
    return this.dlq;
  }

  /** DLQ 재시도 실행 */
  async retryDlq(): Promise<{ success: number; failed: number }> {
    const retryable = this.dlq.getRetryable(this.config.maxRetries);
    let success = 0;
    let failed = 0;

    for (const item of retryable) {
      try {
        const transformed = this.applyTransforms(item.event);
        if (transformed) {
          await this.writeToSinks([transformed]);
          this.dlq.remove(item.event.id);
          success += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return { success, failed };
  }

  // -- 내부 메서드 ──────────────────────────────────────────────────────────

  /** 이벤트 수신 처리 */
  private onEvent(event: StreamEvent): void {
    // CSAP D-08: 테넌트 격리 검증 -- Design §7
    if (event.tenantId !== this.config.tenantId) {
      this.emit('security', {
        type: 'CROSS_TENANT_ACCESS',
        pipelineId: this.config.pipelineId,
        expectedTenantId: this.config.tenantId,
        actualTenantId: event.tenantId,
        eventId: event.id,
        timestamp: new Date().toISOString(),
      });
      this.metricsData.eventsFailed += 1;
      return; // 차단
    }

    this.metricsData.eventsReceived += 1;

    // 백프레셔: 버퍼 초과 시 소스 일시 정지 -- Design §1
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.pause();
      return;
    }

    // 변환 적용
    const transformed = this.applyTransforms(event);
    if (!transformed) {
      this.metricsData.eventsFiltered += 1;
      return;
    }

    this.buffer.push(transformed);

    // 배치 크기 도달 시 즉시 플러시
    if (this.buffer.length >= this.config.batchSize) {
      this.flushBuffer().catch((err) => this.emit('error', err));
    }
  }

  /** 변환 파이프라인 적용 -- Design §3 */
  private applyTransforms(event: StreamEvent): StreamEvent | null {
    let current: StreamEvent | null = event;
    for (const transform of this.transforms) {
      if (!current) return null;
      current = transform(current);
    }
    return current;
  }

  /** 버퍼 플러시 → 싱크 쓰기 */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.config.batchSize);
    const startTime = Date.now();

    try {
      await this.writeToSinks(batch);
      const latency = Date.now() - startTime;
      this.metricsData.eventsProcessed += batch.length;

      // 지연 시간 기록 (최근 1000건만 유지)
      this.metricsData.latencies.push(latency);
      if (this.metricsData.latencies.length > 1000) {
        this.metricsData.latencies = this.metricsData.latencies.slice(-1000);
      }

      this.emit('batch', {
        pipelineId: this.config.pipelineId,
        count: batch.length,
        latencyMs: latency,
      });
    } catch (error) {
      // 실패 이벤트 DLQ로 -- Design §5
      for (const event of batch) {
        this.dlq.enqueue(event, error instanceof Error ? error.message : String(error));
      }
      this.metricsData.eventsFailed += batch.length;
      this.emit('error', error);
    }

    // 백프레셔 해제: 버퍼 절반 이하로 감소 시 소스 재개
    if (this.state === 'paused' && this.buffer.length < this.config.maxBufferSize / 2) {
      this.resume();
    }
  }

  /** 모든 싱크에 쓰기 */
  private async writeToSinks(events: StreamEvent[]): Promise<void> {
    const results = await Promise.allSettled(
      this.sinks.map((sink) => sink.write(events)),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      const reasons = failures
        .map((f) => (f as PromiseRejectedResult).reason)
        .join('; ');
      throw new Error(`싱크 쓰기 실패 (${failures.length}/${this.sinks.length}): ${reasons}`);
    }
  }

  /** 배치 타이머 시작 -- Design §1 */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.batchTimer = setTimeout(async () => {
      await this.flushBuffer().catch((err) => this.emit('error', err));
      if (this.state === 'running') {
        this.startBatchTimer();
      }
    }, this.config.batchTimeoutMs);
  }
}

// -- 파이프라인 팩토리 ────────────────────────────────────────────────────────

/** 기본 설정으로 파이프라인 생성 */
export function createStreamPipeline(
  pipelineId: string,
  tenantId: string,
  options?: Partial<StreamConfig>,
): StreamProcessor {
  const config: StreamConfig = {
    pipelineId,
    tenantId,
    batchSize: options?.batchSize ?? 100,
    batchTimeoutMs: options?.batchTimeoutMs ?? 5000,
    maxBufferSize: options?.maxBufferSize ?? 10000,
    maxRetries: options?.maxRetries ?? 3,
    retryDelayMs: options?.retryDelayMs ?? 1000,
  };
  return new StreamProcessor(config);
}

/** 공공데이터 폴링 파이프라인 프리셋 */
export function createPublicDataPipeline(
  tenantId: string,
  dataUrl: string,
  options?: {
    pollIntervalMs?: number;
    sinkChannel?: string;
  },
): StreamProcessor {
  const pipelineId = `pub-data-${tenantId}-${Date.now()}`;
  const processor = createStreamPipeline(pipelineId, tenantId);

  // 소스: HTTP 폴링
  const source = new HttpPollingSource({
    url: dataUrl,
    intervalMs: options?.pollIntervalMs ?? 60000,
    tenantId,
  });

  // 변환: 등급 검증 → PII 마스킹
  processor
    .setSource(source)
    .addTransform(gradeCheckTransform())
    .addTransform(piiMaskTransform())
    .addSink(new EventBusSink({ channel: options?.sinkChannel ?? 'public-data' }));

  return processor;
}

// -- 파이프라인 관리자 ────────────────────────────────────────────────────────

/** 다중 파이프라인 관리자 -- Design §7 테넌트 격리 */
export class PipelineManager {
  private pipelines = new Map<string, StreamProcessor>();

  /** 파이프라인 등록 */
  register(processor: StreamProcessor): void {
    const metrics = processor.getMetrics();
    const key = `${metrics.tenantId}:${metrics.pipelineId}`;
    this.pipelines.set(key, processor);
  }

  /** 테넌트별 파이프라인 조회 -- CSAP D-08 */
  getByTenant(tenantId: string): StreamProcessor[] {
    const result: StreamProcessor[] = [];
    for (const [key, processor] of this.pipelines) {
      if (key.startsWith(`${tenantId}:`)) {
        result.push(processor);
      }
    }
    return result;
  }

  /** 파이프라인 조회 */
  get(tenantId: string, pipelineId: string): StreamProcessor | undefined {
    return this.pipelines.get(`${tenantId}:${pipelineId}`);
  }

  /** 전체 메트릭 -- Design §6 */
  getAllMetrics(): PipelineMetrics[] {
    return Array.from(this.pipelines.values()).map((p) => p.getMetrics());
  }

  /** 모든 파이프라인 정지 */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.pipelines.values()).map((p) => p.stop());
    await Promise.allSettled(stopPromises);
  }

  /** 등록 해제 */
  unregister(tenantId: string, pipelineId: string): boolean {
    return this.pipelines.delete(`${tenantId}:${pipelineId}`);
  }

  /** 등록된 파이프라인 수 */
  size(): number {
    return this.pipelines.size;
  }
}
