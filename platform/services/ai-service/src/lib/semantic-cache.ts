// 시맨틱 캐시 — FR-ADV8.1, FR-ADV8.2, FR-ADV8.3, FR-ADV8.7, FR-ADV8.8
// Design Ref: SVC-AI-ADV-R8 DESIGN §1
// Plan SC: SC-1 (코사인 유사도 0.92+), SC-5 (히트율 70%+)
// CSAP: D-12 시스템 개발 보안, D-08 접근 통제 (테넌트 격리)
// N2SF: N-05 캐시 키에 PII 미포함

import { maskPII } from './pii-masking.js';

// ── 캐시 엔트리 ──────────────────────────────────────────────────────────────

/** 캐시 엔트리 */
export interface CacheEntry {
  /** 정규화된 쿼리 해시 */
  key: string;
  /** 쿼리 임베딩 벡터 */
  embedding: number[];
  /** 캐시된 LLM 응답 */
  response: string;
  /** 테넌트 ID (격리용) */
  tenantId: string;
  /** 사용된 모델 ID */
  model: string;
  /** 생성 시각 (ms) */
  createdAt: number;
  /** 최종 접근 시각 (ms) */
  accessedAt: number;
  /** 히트 횟수 */
  hitCount: number;
}

/** 캐시 조회 결과 */
export interface CacheLookupResult {
  /** 캐시 히트 여부 */
  hit: boolean;
  /** 캐시된 응답 (히트 시) */
  response?: string;
  /** 유사도 점수 (히트 시) */
  similarity?: number;
  /** 캐시된 모델 (히트 시) */
  model?: string;
}

// ── 설정 ─────────────────────────────────────────────────────────────────────

/** 시맨틱 캐시 설정 */
export interface SemanticCacheConfig {
  /** 유사도 임계값 (기본 0.92) */
  similarityThreshold?: number;
  /** 캐시 TTL (ms, 기본 24시간) */
  ttlMs?: number;
  /** 최대 엔트리 수 (기본 10,000) */
  maxEntries?: number;
  /** 정리 간격 (ms, 기본 10분) */
  cleanupIntervalMs?: number;
}

const DEFAULT_CONFIG: Required<SemanticCacheConfig> = {
  similarityThreshold: 0.92,
  ttlMs: 24 * 60 * 60 * 1000, // 24시간
  maxEntries: 10_000,
  cleanupIntervalMs: 10 * 60 * 1000, // 10분
};

// ── 임베딩 프로바이더 인터페이스 ─────────────────────────────────────────────

/** 임베딩 생성 함수 시그니처 (DIP) */
export type EmbedFunction = (text: string) => Promise<number[]>;

// ── 시맨틱 캐시 클래스 ───────────────────────────────────────────────────────

/**
 * 시맨틱 캐시 — LLM 응답을 임베딩 유사도 기반으로 캐싱
 *
 * 동일하거나 유사한 질문에 대해 이전 LLM 응답을 재사용하여 비용을 절감합니다.
 * 코사인 유사도 0.92 이상일 때 캐시 히트로 판정합니다.
 *
 * 특징:
 * - 테넌트 격리: 캐시 키에 tenantId 포함 (CSAP D-08)
 * - PII 제거: 캐시 키 생성 시 PII 마스킹 (N2SF N-05)
 * - LRU 정책: 최대 엔트리 수 초과 시 최소 접근 엔트리 제거
 * - TTL 정책: 만료된 엔트리 자동 제거
 */
export class SemanticCache {
  private readonly config: Required<SemanticCacheConfig>;
  private readonly embedFn: EmbedFunction;
  private readonly entries: Map<string, CacheEntry> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // 통계
  private totalLookups = 0;
  private totalHits = 0;

  constructor(embedFn: EmbedFunction, config?: SemanticCacheConfig) {
    this.embedFn = embedFn;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 주기적 만료 정리
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * 쿼리에 대한 캐시 조회
   *
   * @param query - 사용자 쿼리
   * @param tenantId - 테넌트 ID (격리)
   * @returns 캐시 조회 결과
   */
  async lookup(query: string, tenantId: string): Promise<CacheLookupResult> {
    this.totalLookups++;

    // 쿼리 정규화 + PII 제거 — FR-ADV8.2
    const normalizedQuery = normalizeQuery(query);
    const queryEmbedding = await this.embedFn(normalizedQuery);

    // 동일 테넌트 엔트리만 검색 — FR-ADV8.8
    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;

    const now = Date.now();
    for (const entry of this.entries.values()) {
      // 테넌트 격리
      if (entry.tenantId !== tenantId) continue;

      // TTL 만료 확인
      if (now - entry.createdAt > this.config.ttlMs) continue;

      // 코사인 유사도 계산
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    // 임계값 비교
    if (bestMatch && bestSimilarity >= this.config.similarityThreshold) {
      // 캐시 히트 — 접근 정보 갱신
      bestMatch.accessedAt = now;
      bestMatch.hitCount++;
      this.totalHits++;

      return {
        hit: true,
        response: bestMatch.response,
        similarity: bestSimilarity,
        model: bestMatch.model,
      };
    }

    return { hit: false };
  }

  /**
   * LLM 응답을 캐시에 저장
   *
   * @param query - 원본 쿼리
   * @param response - LLM 응답
   * @param tenantId - 테넌트 ID
   * @param model - 사용된 모델 ID
   */
  async store(query: string, response: string, tenantId: string, model: string): Promise<void> {
    // LRU 제거 — FR-ADV8.3
    if (this.entries.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const normalizedQuery = normalizeQuery(query);
    const embedding = await this.embedFn(normalizedQuery);
    const key = `${tenantId}:${hashString(normalizedQuery)}`;

    const entry: CacheEntry = {
      key,
      embedding,
      response,
      tenantId,
      model,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      hitCount: 0,
    };

    this.entries.set(key, entry);
  }

  /**
   * 캐시 무효화 — FR-ADV8.7
   *
   * @param tenantId - 테넌트 ID
   * @param pattern - 선택적 키 패턴 (미제공 시 해당 테넌트 전체 삭제)
   * @returns 삭제된 엔트리 수
   */
  invalidate(tenantId: string, pattern?: string): number {
    let deletedCount = 0;
    const regex = pattern ? new RegExp(pattern) : null;

    for (const [key, entry] of this.entries) {
      if (entry.tenantId !== tenantId) continue;
      if (regex && !regex.test(key)) continue;

      this.entries.delete(key);
      deletedCount++;
    }

    return deletedCount;
  }

  /**
   * 캐시 통계 반환
   */
  getStats(): {
    totalEntries: number;
    totalLookups: number;
    totalHits: number;
    hitRate: number;
    entriesByTenant: Record<string, number>;
  } {
    const entriesByTenant: Record<string, number> = {};
    for (const entry of this.entries.values()) {
      entriesByTenant[entry.tenantId] = (entriesByTenant[entry.tenantId] ?? 0) + 1;
    }

    return {
      totalEntries: this.entries.size,
      totalLookups: this.totalLookups,
      totalHits: this.totalHits,
      hitRate: this.totalLookups > 0 ? this.totalHits / this.totalLookups : 0,
      entriesByTenant,
    };
  }

  /** 캐시 전체 초기화 */
  clear(): void {
    this.entries.clear();
    this.totalLookups = 0;
    this.totalHits = 0;
  }

  /** 리소스 정리 (서버 종료 시) */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
  }

  // ── 내부 메서드 ────────────────────────────────────────────────────

  /** 만료된 엔트리 정리 */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.createdAt > this.config.ttlMs) {
        this.entries.delete(key);
      }
    }
  }

  /** LRU 정책 — 최소 접근 엔트리 제거 */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccessTime = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.accessedAt < oldestAccessTime) {
        oldestAccessTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
    }
  }
}

// ── 유틸리티 함수 ────────────────────────────────────────────────────────────

/**
 * 쿼리 정규화 — 캐시 키 일관성 보장
 * 1. PII 마스킹 (N2SF N-05)
 * 2. 소문자 변환
 * 3. 연속 공백 정리
 * 4. 양쪽 공백 제거
 */
function normalizeQuery(query: string): string {
  return maskPII(query)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 코사인 유사도 계산
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * 문자열 해시 (캐시 키용, 보안 해시 아님)
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수 변환
  }
  return Math.abs(hash).toString(36);
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

/**
 * 시맨틱 캐시 인스턴스 생성
 */
export function createSemanticCache(embedFn: EmbedFunction, config?: SemanticCacheConfig): SemanticCache {
  return new SemanticCache(embedFn, config);
}
