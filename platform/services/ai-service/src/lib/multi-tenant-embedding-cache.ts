// Multi-Tenant Embedding Cache — FR-R54.1~R54.6
// Design Ref: SVC-AI-ADV-R54 DESIGN §2, §4, §5
// Plan SC: 임베딩 API 40% 절감, 히트율 ≥ 50%
// CSAP: D-08 접근 통제, D-06 감사 로깅
// N2SF: 공유 계층은 O등급 only

import { createHash } from 'node:crypto';

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'O' | 'C' | 'S';

export interface EmbeddingEntry {
  vector: number[];
  createdAt: number;
}

export interface CacheStats {
  privateHits: number;
  sharedHits: number;
  misses: number;
  hitRate: number;
}

export interface CacheAuditEntry {
  timestamp: number;
  action:
    | 'SET_PRIVATE'
    | 'SET_SHARED'
    | 'HIT_PRIVATE'
    | 'HIT_SHARED'
    | 'MISS'
    | 'BLOCK_GRADE'
    | 'EVICT_PRIVATE'
    | 'EVICT_SHARED';
  tenantId?: string;
  key?: string;
}

export interface CacheConfig {
  /** 테넌트 전용 계층 최대 엔트리 수 (기본 10,000) */
  maxPrivate?: number;
  /** 공유 계층 최대 엔트리 수 (기본 50,000) */
  maxShared?: number;
}

const DEFAULT_MAX_PRIVATE = 10_000;
const DEFAULT_MAX_SHARED = 50_000;

// ── MultiTenantEmbeddingCache ────────────────────────────────────────────────

/**
 * 테넌트 격리 2계층 임베딩 캐시.
 *
 * - 전용(private): 테넌트별 독립 LRU. 등급 무관 저장 가능.
 * - 공유(shared): 전역 공통 LRU. N2SF O등급 텍스트만 진입.
 *
 * `lookup`은 전용 → 공유 순으로 검색하며, 공유에서 hit 하면
 * 즉시 해당 테넌트 전용 계층에도 승격(promote) 저장합니다.
 */
export class MultiTenantEmbeddingCache {
  private readonly privateStore = new Map<string, Map<string, EmbeddingEntry>>();
  private readonly sharedStore = new Map<string, EmbeddingEntry>();
  private readonly auditLog: CacheAuditEntry[] = [];
  private readonly maxPrivate: number;
  private readonly maxShared: number;
  private privateHitCount = 0;
  private sharedHitCount = 0;
  private missCount = 0;

  constructor(config: CacheConfig = {}) {
    this.maxPrivate = config.maxPrivate ?? DEFAULT_MAX_PRIVATE;
    this.maxShared = config.maxShared ?? DEFAULT_MAX_SHARED;
  }

  // ── FR-R54.1: 해시 키 ─────────────────────────────────────────────────────

  hashKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  // ── FR-R54.2: 전용 계층 ───────────────────────────────────────────────────

  getPrivate(tenantId: string, key: string): EmbeddingEntry | undefined {
    const tenantMap = this.privateStore.get(tenantId);
    if (!tenantMap) return undefined;
    const entry = tenantMap.get(key);
    if (!entry) return undefined;
    // LRU touch: Map은 삽입 순서 유지 → 재삽입으로 끝으로 이동
    tenantMap.delete(key);
    tenantMap.set(key, entry);
    return entry;
  }

  setPrivate(tenantId: string, key: string, vector: number[]): void {
    let tenantMap = this.privateStore.get(tenantId);
    if (!tenantMap) {
      tenantMap = new Map<string, EmbeddingEntry>();
      this.privateStore.set(tenantId, tenantMap);
    }
    if (tenantMap.has(key)) {
      tenantMap.delete(key);
    }
    tenantMap.set(key, { vector, createdAt: Date.now() });
    this.evictPrivate(tenantId, tenantMap);
    this.audit({ timestamp: Date.now(), action: 'SET_PRIVATE', tenantId, key });
  }

  // ── FR-R54.3: 공유 계층 (O등급 only) ──────────────────────────────────────

  getShared(key: string): EmbeddingEntry | undefined {
    const entry = this.sharedStore.get(key);
    if (!entry) return undefined;
    this.sharedStore.delete(key);
    this.sharedStore.set(key, entry);
    return entry;
  }

  setShared(key: string, vector: number[], grade: DataGrade): void {
    if (grade !== 'O') {
      this.audit({ timestamp: Date.now(), action: 'BLOCK_GRADE', key });
      throw new Error('CACHE_GRADE_BLOCKED');
    }
    if (this.sharedStore.has(key)) {
      this.sharedStore.delete(key);
    }
    this.sharedStore.set(key, { vector, createdAt: Date.now() });
    this.evictShared();
    this.audit({ timestamp: Date.now(), action: 'SET_SHARED', key });
  }

  // ── FR-R54.4: 이중 조회 ───────────────────────────────────────────────────

  /**
   * 전용 계층을 먼저 확인하고, 미스 시 공유 계층을 확인합니다.
   * 공유에서 hit 하면 해당 테넌트 전용 계층에 승격 저장합니다.
   */
  lookup(tenantId: string, text: string, grade: DataGrade): EmbeddingEntry | undefined {
    const key = this.hashKey(text);
    const priv = this.getPrivate(tenantId, key);
    if (priv) {
      this.privateHitCount += 1;
      this.audit({ timestamp: Date.now(), action: 'HIT_PRIVATE', tenantId, key });
      return priv;
    }
    if (grade === 'O') {
      const shared = this.getShared(key);
      if (shared) {
        this.sharedHitCount += 1;
        // promote
        this.setPrivateDirect(tenantId, key, shared);
        this.audit({ timestamp: Date.now(), action: 'HIT_SHARED', tenantId, key });
        return shared;
      }
    }
    this.missCount += 1;
    this.audit({ timestamp: Date.now(), action: 'MISS', tenantId, key });
    return undefined;
  }

  /**
   * 새 임베딩을 저장합니다. O등급이면 공유 계층에도 함께 저장합니다.
   */
  store(tenantId: string, text: string, vector: number[], grade: DataGrade): void {
    const key = this.hashKey(text);
    this.setPrivate(tenantId, key, vector);
    if (grade === 'O') {
      this.setShared(key, vector, grade);
    }
  }

  // ── FR-R54.5: LRU evict ───────────────────────────────────────────────────

  private evictPrivate(tenantId: string, tenantMap: Map<string, EmbeddingEntry>): void {
    while (tenantMap.size > this.maxPrivate) {
      const oldestKey = tenantMap.keys().next().value;
      if (oldestKey === undefined) break;
      tenantMap.delete(oldestKey);
      this.audit({
        timestamp: Date.now(),
        action: 'EVICT_PRIVATE',
        tenantId,
        key: oldestKey,
      });
    }
  }

  private evictShared(): void {
    while (this.sharedStore.size > this.maxShared) {
      const oldestKey = this.sharedStore.keys().next().value;
      if (oldestKey === undefined) break;
      this.sharedStore.delete(oldestKey);
      this.audit({ timestamp: Date.now(), action: 'EVICT_SHARED', key: oldestKey });
    }
  }

  // ── FR-R54.6: 통계/감사 ───────────────────────────────────────────────────

  getStats(): CacheStats {
    const total = this.privateHitCount + this.sharedHitCount + this.missCount;
    const hitRate = total === 0 ? 0 : (this.privateHitCount + this.sharedHitCount) / total;
    return {
      privateHits: this.privateHitCount,
      sharedHits: this.sharedHitCount,
      misses: this.missCount,
      hitRate: +hitRate.toFixed(4),
    };
  }

  getAuditLog(): readonly CacheAuditEntry[] {
    return this.auditLog;
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────

  private setPrivateDirect(tenantId: string, key: string, entry: EmbeddingEntry): void {
    let tenantMap = this.privateStore.get(tenantId);
    if (!tenantMap) {
      tenantMap = new Map<string, EmbeddingEntry>();
      this.privateStore.set(tenantId, tenantMap);
    }
    if (tenantMap.has(key)) {
      tenantMap.delete(key);
    }
    tenantMap.set(key, entry);
    this.evictPrivate(tenantId, tenantMap);
  }

  private audit(entry: CacheAuditEntry): void {
    this.auditLog.push(entry);
  }
}
