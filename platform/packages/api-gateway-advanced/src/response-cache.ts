// LRU 응답 캐시
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.1, FR-GW.2, FR-GW.6
// CSAP: D-10 접근 제어, D-12 시스템 개발 보안

/**
 * 캐시 엔트리
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hitCount: number;
}

/**
 * 캐시 통계
 */
export interface CacheStats {
  /** 총 요청 수 */
  totalRequests: number;
  /** 캐시 히트 수 */
  hits: number;
  /** 캐시 미스 수 */
  misses: number;
  /** 적중률 (%) */
  hitRate: number;
  /** 현재 엔트리 수 */
  size: number;
  /** 최대 용량 */
  maxSize: number;
  /** 퇴출(eviction) 수 */
  evictions: number;
}

/**
 * 캐시 옵션
 */
export interface ResponseCacheOptions {
  /** 최대 엔트리 수 (기본: 1000) */
  maxSize?: number;
  /** 기본 TTL (밀리초, 기본: 60000) */
  defaultTtlMs?: number;
  /** 만료 엔트리 정리 주기 (밀리초, 기본: 300000) */
  cleanupIntervalMs?: number;
}

/**
 * LRU 응답 캐시
 *
 * Least Recently Used 퇴출 정책 + TTL 기반 만료를 지원합니다.
 * 테넌트별 캐시 분리를 위해 키에 테넌트 ID를 포함할 수 있습니다.
 *
 * 캐시 키 전략:
 * - URL 기반: `GET:/api/users`
 * - 테넌트 분리: `tenant-1:GET:/api/users`
 * - 파라미터 포함: `GET:/api/users?page=1`
 */
export class ResponseCache<T = unknown> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private totalRequests = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: ResponseCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTtlMs = options.defaultTtlMs ?? 60_000;

    const cleanupMs = options.cleanupIntervalMs ?? 300_000;
    if (cleanupMs > 0) {
      this.cleanupInterval = setInterval(() => this.removeExpired(), cleanupMs);
    }
  }

  /**
   * 캐시에서 값 조회
   *
   * @param key 캐시 키
   * @param now 현재 시각 (테스트용 오버라이드)
   * @returns 캐시된 값 또는 undefined (미스)
   */
  get(key: string, now: number = Date.now()): T | undefined {
    this.totalRequests++;
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // TTL 만료 확인
    if (now >= entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // LRU: 조회 시 맨 뒤로 이동 (Map은 삽입 순서 유지)
    this.cache.delete(key);
    entry.hitCount++;
    this.cache.set(key, entry);
    this.hits++;

    return entry.value;
  }

  /**
   * 캐시에 값 저장
   *
   * @param key 캐시 키
   * @param value 저장할 값
   * @param ttlMs TTL (밀리초, 0이면 기본값 사용)
   * @param now 현재 시각 (테스트용 오버라이드)
   */
  set(key: string, value: T, ttlMs: number = 0, now: number = Date.now()): void {
    const effectiveTtl = ttlMs > 0 ? ttlMs : this.defaultTtlMs;

    // 기존 키 업데이트 (LRU 순서 갱신)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 용량 초과 시 가장 오래된(LRU) 엔트리 퇴출
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: now + effectiveTtl,
      createdAt: now,
      hitCount: 0,
    });
  }

  /**
   * 특정 키 무효화
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 접두사(prefix) 패턴 무효화
   *
   * @param prefix 키 접두사 (예: 'tenant-1:')
   * @returns 삭제된 엔트리 수
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 전체 캐시 비우기
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 키 존재 확인 (만료 미검사)
   */
  has(key: string, now: number = Date.now()): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return now < entry.expiresAt;
  }

  /**
   * 현재 캐시 크기
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * 캐시 통계
   */
  getStats(): CacheStats {
    return {
      totalRequests: this.totalRequests,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.totalRequests > 0
        ? Math.round((this.hits / this.totalRequests) * 10000) / 100
        : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
      evictions: this.evictions,
    };
  }

  /**
   * 통계 리셋
   */
  resetStats(): void {
    this.totalRequests = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  /**
   * 만료된 엔트리 정리
   */
  private removeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * 캐시 키 생성 유틸리티
 */
export function buildCacheKey(
  method: string,
  url: string,
  tenantId?: string,
): string {
  const base = `${method.toUpperCase()}:${url}`;
  return tenantId ? `${tenantId}:${base}` : base;
}
