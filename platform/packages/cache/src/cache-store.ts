// Redis 캐싱 추상화 레이어
// Design Ref: SVC-CACHE-R7 Plan
// Plan SC: FR-CACHE.1, FR-CACHE.2, FR-CACHE.3
// CSAP: D-07 가용성, D-08-05 테넌트 격리

/**
 * 캐시 항목 구조
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl: number;
  tenantId: string;
}

/**
 * 캐시 설정
 */
export interface CacheConfig {
  /** 기본 TTL (초) */
  defaultTtlSeconds: number;
  /** 최대 항목 수 (메모리 보호) */
  maxEntries: number;
  /** 캐시 키 접두사 */
  prefix: string;
}

/**
 * 캐시 통계
 */
export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  evictions: number;
  hitRate: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTtlSeconds: 300, // 5분
  maxEntries: 10000,
  prefix: 'saas',
};

/**
 * 테넌트 인식 캐시 스토어
 *
 * CSAP D-08-05: 테넌트별 캐시 키 격리
 * CSAP D-07: 가용성 -- 캐시 실패 시 원본 데이터 반환 (graceful degradation)
 *
 * 캐시 키 패턴: {prefix}:{service}:{tenantId}:{resource}:{identifier}
 */
export class CacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly config: CacheConfig;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 캐시 키 생성 (CSAP D-08-05: 테넌트 격리)
   */
  buildKey(service: string, tenantId: string, resource: string, identifier?: string): string {
    const parts = [this.config.prefix, service, tenantId, resource];
    if (identifier) parts.push(identifier);
    return parts.join(':');
  }

  /**
   * 캐시 조회
   * @returns 캐시 히트 시 값, 미스 시 undefined
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // TTL 만료 확인
    const elapsed = (Date.now() - entry.createdAt) / 1000;
    if (elapsed >= entry.ttl) {
      this.store.delete(key);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * 캐시 저장
   */
  set<T>(key: string, value: T, tenantId: string, ttlSeconds?: number): void {
    // 최대 항목 수 초과 시 가장 오래된 항목 제거
    if (this.store.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    this.store.set(key, {
      value,
      createdAt: Date.now(),
      ttl: ttlSeconds ?? this.config.defaultTtlSeconds,
      tenantId,
    });
  }

  /**
   * 캐시 삭제 (단일 키)
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 패턴 기반 캐시 삭제
   * CSAP D-08-05: 특정 테넌트의 캐시만 선택적 삭제
   *
   * @param pattern - 와일드카드 패턴 (예: "saas:tenant:t-001:*")
   * @returns 삭제된 항목 수
   */
  deleteByPattern(pattern: string): number {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * 테넌트별 캐시 전체 삭제
   * CSAP D-08-05: 테넌트 삭제/정지 시 관련 캐시 즉시 제거
   */
  invalidateTenant(tenantId: string): number {
    let deleted = 0;
    for (const [key, entry] of this.store.entries()) {
      if ((entry as CacheEntry<unknown>).tenantId === tenantId) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * "Read-through" 패턴: 캐시에 없으면 fetcher 실행 후 캐싱
   */
  async getOrFetch<T>(
    key: string,
    tenantId: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, tenantId, ttlSeconds);
    return value;
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      entries: this.store.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * 전체 캐시 초기화
   */
  clear(): void {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * 만료된 항목 수동 정리 (스케줄러용)
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store.entries()) {
      const elapsed = (now - (entry as CacheEntry<unknown>).createdAt) / 1000;
      if (elapsed >= (entry as CacheEntry<unknown>).ttl) {
        this.store.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * 가장 오래된 항목 제거 (LRU 근사)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.store.entries()) {
      if ((entry as CacheEntry<unknown>).createdAt < oldestTime) {
        oldestTime = (entry as CacheEntry<unknown>).createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.store.delete(oldestKey);
      this.stats.evictions++;
    }
  }
}
