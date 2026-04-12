// Idempotency Manager -- 멱등성 키 기반 중복 요청 방지
// Design Ref: SVC-IDEMPOTENT-R39 DESIGN
// Plan SC: FR-ID.1~FR-ID.6
// CSAP: D-12 개발보안, D-14 가용성

export type IdempotencyState = 'inProgress' | 'completed' | 'failed';

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  state: IdempotencyState;
  result?: unknown;
  error?: string;
  createdAt: number;
  expiresAt: number;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined>;
  set(key: string, record: IdempotencyRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

export type BeginResult =
  | { state: 'fresh' }
  | { state: 'completed'; result: unknown }
  | { state: 'inProgress' }
  | { state: 'conflict'; existingHash: string };

export interface IdempotencyOptions {
  /** TTL (밀리초) */
  ttlMs: number;
  /** 저장소. 미지정 시 메모리 저장소 */
  store?: IdempotencyStore;
}

/**
 * 메모리 저장소 (기본)
 * Plan SC: FR-ID.6
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly data = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const record = this.data.get(key);
    if (!record) return undefined;
    if (record.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return record;
  }

  async set(key: string, record: IdempotencyRecord): Promise<void> {
    this.data.set(key, record);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  /** 만료된 레코드 일괄 제거 */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, record] of this.data) {
      if (record.expiresAt <= now) {
        this.data.delete(key);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.data.size;
  }
}

/**
 * Idempotency Manager
 *
 * Plan SC: FR-ID.1~FR-ID.6
 */
export class IdempotencyManager {
  private readonly store: IdempotencyStore;
  private readonly ttlMs: number;

  constructor(options: IdempotencyOptions) {
    if (options.ttlMs <= 0) {
      throw new Error('ttlMs는 0보다 커야 합니다.');
    }
    this.ttlMs = options.ttlMs;
    this.store = options.store ?? new MemoryIdempotencyStore();
  }

  /**
   * 요청 시작. 상태에 따라 다른 결과 반환.
   * Plan SC: FR-ID.1, FR-ID.2, FR-ID.3
   */
  async begin(key: string, requestHash: string): Promise<BeginResult> {
    if (!key) throw new Error('idempotency key는 비어있을 수 없습니다.');
    if (!requestHash) throw new Error('request hash는 비어있을 수 없습니다.');

    const existing = await this.store.get(key);

    if (!existing) {
      const now = Date.now();
      await this.store.set(key, {
        key,
        requestHash,
        state: 'inProgress',
        createdAt: now,
        expiresAt: now + this.ttlMs,
      });
      return { state: 'fresh' };
    }

    // 해시 불일치 = 동일 키로 다른 요청 (충돌)
    if (existing.requestHash !== requestHash) {
      return { state: 'conflict', existingHash: existing.requestHash };
    }

    if (existing.state === 'completed') {
      return { state: 'completed', result: existing.result };
    }

    if (existing.state === 'failed') {
      // 실패한 요청은 재시도 허용: 새로운 inProgress로 교체
      const now = Date.now();
      await this.store.set(key, {
        key,
        requestHash,
        state: 'inProgress',
        createdAt: now,
        expiresAt: now + this.ttlMs,
      });
      return { state: 'fresh' };
    }

    return { state: 'inProgress' };
  }

  /**
   * 요청 성공 저장
   * Plan SC: FR-ID.2
   */
  async complete(key: string, result: unknown): Promise<void> {
    const existing = await this.store.get(key);
    if (!existing) {
      throw new Error(`idempotency 레코드를 찾을 수 없습니다: ${key}`);
    }
    await this.store.set(key, {
      ...existing,
      state: 'completed',
      result,
    });
  }

  /**
   * 요청 실패 저장 (재시도 가능 상태)
   */
  async fail(key: string, error: Error): Promise<void> {
    const existing = await this.store.get(key);
    if (!existing) return;
    await this.store.set(key, {
      ...existing,
      state: 'failed',
      error: error.message,
    });
  }

  /**
   * 레코드 수동 제거
   * Plan SC: FR-ID.4
   */
  async invalidate(key: string): Promise<void> {
    await this.store.delete(key);
  }
}

/**
 * 멱등성 키 실행 헬퍼 — begin/complete/fail 자동 관리
 * Plan SC: FR-ID.5
 */
export async function withIdempotency<T>(
  manager: IdempotencyManager,
  key: string,
  requestHash: string,
  fn: () => Promise<T>,
): Promise<{ result: T; cached: boolean }> {
  const result = await manager.begin(key, requestHash);

  if (result.state === 'completed') {
    return { result: result.result as T, cached: true };
  }

  if (result.state === 'conflict') {
    throw new IdempotencyConflictError(
      `멱등성 키 충돌: ${key} (요청 내용이 일치하지 않음)`,
    );
  }

  if (result.state === 'inProgress') {
    throw new IdempotencyInProgressError(`동일 키가 진행 중: ${key}`);
  }

  try {
    const value = await fn();
    await manager.complete(key, value);
    return { result: value, cached: false };
  } catch (error) {
    await manager.fail(key, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT';
}

export class IdempotencyInProgressError extends Error {
  readonly code = 'IDEMPOTENCY_IN_PROGRESS';
}
