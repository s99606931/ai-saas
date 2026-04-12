// Transactional Outbox -- at-least-once 이벤트 발행
// Design Ref: SVC-OUTBOX-R43 DESIGN
// Plan SC: FR-OB.1~FR-OB.6
// CSAP: D-06 감사, D-14 가용성

import { randomBytes } from 'node:crypto';

export type OutboxStatus = 'pending' | 'published' | 'dead_letter';

export interface OutboxEvent {
  /** 이벤트 유형 (예: 'order.created') */
  eventType: string;
  /** 이벤트 페이로드 (JSON 직렬화 가능) */
  payload: unknown;
  /** 집계 키 (예: order ID, 순서 보장용) */
  aggregateId?: string;
}

export interface OutboxEntry {
  id: string;
  eventType: string;
  payload: unknown;
  aggregateId?: string;
  status: OutboxStatus;
  retryCount: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OutboxStore {
  insert(entry: OutboxEntry): Promise<void>;
  fetchPending(limit: number): Promise<OutboxEntry[]>;
  update(entry: OutboxEntry): Promise<void>;
  listByStatus(status: OutboxStatus): Promise<OutboxEntry[]>;
}

export interface OutboxOptions {
  maxRetries: number;
  store?: OutboxStore;
}

/**
 * 메모리 기반 저장소 (기본)
 * Plan SC: FR-OB.6
 */
export class MemoryOutboxStore implements OutboxStore {
  private readonly entries = new Map<string, OutboxEntry>();

  async insert(entry: OutboxEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry });
  }

  async fetchPending(limit: number): Promise<OutboxEntry[]> {
    const pending: OutboxEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.status === 'pending') {
        pending.push({ ...entry });
        if (pending.length >= limit) break;
      }
    }
    return pending.sort((a, b) => a.createdAt - b.createdAt);
  }

  async update(entry: OutboxEntry): Promise<void> {
    if (!this.entries.has(entry.id)) {
      throw new Error(`Outbox 엔트리를 찾을 수 없습니다: ${entry.id}`);
    }
    this.entries.set(entry.id, { ...entry });
  }

  async listByStatus(status: OutboxStatus): Promise<OutboxEntry[]> {
    const result: OutboxEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.status === status) {
        result.push({ ...entry });
      }
    }
    return result;
  }

  async getById(id: string): Promise<OutboxEntry | undefined> {
    const entry = this.entries.get(id);
    return entry ? { ...entry } : undefined;
  }

  size(): number {
    return this.entries.size;
  }
}

/**
 * Outbox Manager
 *
 * Plan SC: FR-OB.1~FR-OB.6
 */
export class Outbox {
  private readonly store: OutboxStore;
  private readonly maxRetries: number;

  constructor(options: OutboxOptions) {
    if (options.maxRetries < 0) {
      throw new Error('maxRetries는 0 이상이어야 합니다.');
    }
    this.maxRetries = options.maxRetries;
    this.store = options.store ?? new MemoryOutboxStore();
  }

  /**
   * 이벤트 추가 (pending 상태)
   * Plan SC: FR-OB.1
   */
  async append(event: OutboxEvent): Promise<string> {
    if (!event.eventType) {
      throw new Error('eventType은 필수입니다.');
    }
    const id = this.generateId();
    const now = Date.now();
    const entry: OutboxEntry = {
      id,
      eventType: event.eventType,
      payload: event.payload,
      aggregateId: event.aggregateId,
      status: 'pending',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.insert(entry);
    return id;
  }

  /**
   * 미발행 이벤트 조회 (배치 발행용)
   * Plan SC: FR-OB.2
   */
  async fetchPending(limit = 100): Promise<OutboxEntry[]> {
    return this.store.fetchPending(limit);
  }

  /**
   * 발행 완료 마킹
   * Plan SC: FR-OB.3
   */
  async markPublished(id: string): Promise<void> {
    const entries = await this.store.listByStatus('pending');
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      throw new Error(`pending 상태의 엔트리를 찾을 수 없습니다: ${id}`);
    }
    await this.store.update({
      ...entry,
      status: 'published',
      updatedAt: Date.now(),
    });
  }

  /**
   * 발행 실패 처리 (재시도 or dead-letter)
   * Plan SC: FR-OB.4, FR-OB.5
   */
  async markFailed(id: string, error: Error): Promise<'retry' | 'dead'> {
    const pending = await this.store.listByStatus('pending');
    const entry = pending.find((e) => e.id === id);
    if (!entry) {
      throw new Error(`pending 상태의 엔트리를 찾을 수 없습니다: ${id}`);
    }

    const newRetryCount = entry.retryCount + 1;
    const exceeded = newRetryCount > this.maxRetries;

    await this.store.update({
      ...entry,
      status: exceeded ? 'dead_letter' : 'pending',
      retryCount: newRetryCount,
      lastError: error.message,
      updatedAt: Date.now(),
    });

    return exceeded ? 'dead' : 'retry';
  }

  /**
   * Dead-letter 큐 조회
   * Plan SC: FR-OB.5
   */
  async getDeadLetter(): Promise<OutboxEntry[]> {
    return this.store.listByStatus('dead_letter');
  }

  /**
   * 발행된 이벤트 조회
   */
  async getPublished(): Promise<OutboxEntry[]> {
    return this.store.listByStatus('published');
  }

  private generateId(): string {
    return randomBytes(12).toString('hex');
  }
}
