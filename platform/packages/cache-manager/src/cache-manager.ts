// Cache Manager -- LRU + TTL 인메모리 캐시
// Design Ref: SVC-CACHE-R30 DESIGN
// Plan SC: FR-CM.1, FR-CM.2, FR-CM.3, FR-CM.4, FR-CM.5, FR-CM.6
// CSAP: D-14 시스템 가용성 (성능 최적화)

/**
 * 캐시 옵션
 */
export interface CacheOptions {
  /** 최대 항목 수 (기본: 1000) */
  maxSize?: number;
  /** 기본 TTL (밀리초, 기본: 300000 = 5분) */
  defaultTtlMs?: number;
  /** 키 네임스페이스 (테넌트 격리) */
  namespace?: string;
}

/**
 * 캐시 메트릭
 * Plan SC: FR-CM.5
 */
export interface CacheMetrics {
  /** 캐시 적중 수 */
  hits: number;
  /** 캐시 미스 수 */
  misses: number;
  /** LRU 퇴거 수 */
  evictions: number;
  /** 현재 캐시 크기 */
  size: number;
}

/**
 * 내부 캐시 항목
 */
interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * LRU + TTL Cache Manager
 *
 * Map의 삽입 순서 보존 특성을 활용한 LRU 구현입니다.
 * get 시 항목을 delete+set 하여 순서를 갱신합니다.
 * maxSize 초과 시 Map.keys().next() (가장 오래된 항목)를 제거합니다.
 *
 * Plan SC: FR-CM.1 (기본 연산), FR-CM.2 (TTL), FR-CM.3 (LRU),
 *          FR-CM.4 (네임스페이스), FR-CM.5 (메트릭), FR-CM.6 (getOrSet)
 */
export class CacheManager<V = unknown> {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly namespace: string;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTtlMs = options.defaultTtlMs ?? 300_000;
    this.namespace = options.namespace ?? '';
  }

  /**
   * 캐시에서 값 조회
   * Plan SC: FR-CM.1
   */
  get(key: string): V | undefined {
    const fullKey = this.resolveKey(key);
    const entry = this.store.get(fullKey);

    if (!entry) {
      this.metrics.misses++;
      return undefined;
    }

    // TTL 만료 확인 (FR-CM.2)
    if (Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      this.metrics.size = this.store.size;
      this.metrics.misses++;
      return undefined;
    }

    // LRU 순서 갱신: delete + set으로 맨 뒤로 이동 (FR-CM.3)
    this.store.delete(fullKey);
    this.store.set(fullKey, entry);

    this.metrics.hits++;
    return entry.value;
  }

  /**
   * 캐시에 값 저장
   * Plan SC: FR-CM.1
   */
  set(key: string, value: V, ttlMs?: number): void {
    const fullKey = this.resolveKey(key);
    const ttl = ttlMs ?? this.defaultTtlMs;

    // 이미 존재하면 제거 (순서 갱신)
    if (this.store.has(fullKey)) {
      this.store.delete(fullKey);
    }

    // LRU 퇴거: 최대 크기 초과 시 가장 오래된 항목 제거 (FR-CM.3)
    while (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.metrics.evictions++;
      }
    }

    this.store.set(fullKey, {
      value,
      expiresAt: Date.now() + ttl,
    });

    this.metrics.size = this.store.size;
  }

  /**
   * 캐시 항목 삭제
   * Plan SC: FR-CM.1
   */
  delete(key: string): boolean {
    const fullKey = this.resolveKey(key);
    const deleted = this.store.delete(fullKey);
    this.metrics.size = this.store.size;
    return deleted;
  }

  /**
   * 캐시 항목 존재 여부 (TTL 만료 포함)
   * Plan SC: FR-CM.1
   */
  has(key: string): boolean {
    const fullKey = this.resolveKey(key);
    const entry = this.store.get(fullKey);

    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      this.metrics.size = this.store.size;
      return false;
    }

    return true;
  }

  /**
   * 전체 캐시 비우기
   * Plan SC: FR-CM.1
   */
  clear(): void {
    this.store.clear();
    this.metrics.size = 0;
  }

  /**
   * 캐시 미스 시 로더 함수 실행 후 캐시에 저장
   * Plan SC: FR-CM.6
   */
  async getOrSet(
    key: string,
    loader: () => V | Promise<V>,
    ttlMs?: number,
  ): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * 캐시 메트릭 조회
   * Plan SC: FR-CM.5
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics, size: this.store.size };
  }

  /**
   * 현재 캐시 크기
   */
  getSize(): number {
    return this.store.size;
  }

  // -- 내부 메서드 --

  /**
   * 네임스페이스 적용 키 생성
   * Plan SC: FR-CM.4
   */
  private resolveKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }
}
