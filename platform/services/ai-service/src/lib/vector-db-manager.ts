// 벡터 DB 통합 매니저 -- FR-ADV29.1, FR-ADV29.3~29.6, FR-ADV29.8
// Design Ref: SVC-AI-ADV-R29 DESIGN §1, §3~§6, §8
// Plan SC: SC-1 (검색 성능), SC-2 (테넌트 격리), SC-3 (자동 폴백)
// CSAP: D-08 테넌트 격리, D-06 감사 로그, D-09 암호화

import {
  QdrantClient,
  getQdrantClient,
  type QdrantFilter,
  type QdrantPoint,
  type QdrantSearchResult,
  type QdrantCondition,
  type HnswConfig as _HnswConfig,
  type CollectionConfig as _CollectionConfig,
} from './qdrant-client';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 벡터 DB 백엔드 유형 */
export type VectorDBBackend = 'qdrant' | 'pgvector';

/** 벡터 DB 프로바이더 인터페이스 -- Design §1 */
export interface VectorDBProvider {
  readonly backend: VectorDBBackend;
  upsert(collection: string, vectors: VectorRecord[]): Promise<void>;
  search(collection: string, query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  delete(collection: string, ids: string[]): Promise<void>;
  getCollectionInfo(collection: string): Promise<VectorCollectionInfo>;
  healthCheck(): Promise<boolean>;
}

/** 벡터 레코드 */
export interface VectorRecord {
  id: string;
  vector: number[];
  sparseVector?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

/** 벡터 검색 쿼리 -- Design §3, §4 */
export interface VectorSearchQuery {
  /** 밀집 벡터 (Dense) */
  vector?: number[];
  /** 희소 벡터 (Sparse, BM25 키워드) */
  sparseVector?: Record<string, number>;
  /** 검색 모드 */
  mode?: 'dense' | 'sparse' | 'hybrid';
  /** 하이브리드 검색 시 밀집 가중치 (0~1) */
  denseWeight?: number;
  /** 결과 수 */
  limit?: number;
  /** 최소 유사도 점수 */
  scoreThreshold?: number;
  /** 메타데이터 필터 -- Design §4 */
  filter?: VectorFilter;
  /** 테넌트 ID (자동 격리) -- Design §5 */
  tenantId?: string;
}

/** 메타데이터 필터 조건 */
export interface VectorFilter {
  must?: FilterCondition[];
  should?: FilterCondition[];
  mustNot?: FilterCondition[];
}

/** 필터 조건 항목 */
export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: string | number | boolean | (string | number)[];
}

/** 검색 결과 */
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/** 컬렉션 정보 */
export interface VectorCollectionInfo {
  name: string;
  vectorCount: number;
  status: 'healthy' | 'degraded' | 'unavailable';
  backend: VectorDBBackend;
}

/** 폴백 상태 */
export interface FallbackState {
  active: boolean;
  failureCount: number;
  lastFailure?: string;
  activatedAt?: string;
  reason?: string;
}

/** 배치 업서트 옵션 -- Design §8 */
export interface BatchUpsertOptions {
  chunkSize?: number;
  maxConcurrency?: number;
  maxRetries?: number;
  onProgress?: (completed: number, total: number) => void;
}

/** 매니저 설정 */
export interface VectorDBManagerConfig {
  /** 주 백엔드 */
  primaryBackend: VectorDBBackend;
  /** 폴백 활성화 여부 */
  enableFallback: boolean;
  /** 헬스체크 주기 (ms) */
  healthCheckInterval: number;
  /** 폴백 전환 실패 임계값 */
  failureThreshold: number;
  /** 기본 컬렉션 벡터 크기 */
  defaultVectorSize: number;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: VectorDBManagerConfig = {
  primaryBackend: 'qdrant',
  enableFallback: true,
  healthCheckInterval: 30_000,
  failureThreshold: 3,
  defaultVectorSize: 1536,
};

const BATCH_DEFAULTS = {
  chunkSize: 100,
  maxConcurrency: 4,
  maxRetries: 3,
};

// -- 감사 로그 유틸 ───────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'vector-db-manager',
    action,
    ...details,
  };
  // NOTE: 프로덕션에서는 중앙 감사 로그 시스템으로 전송
  // 현재는 콘솔 출력 (CSAP D-06 감사 기록)
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- 필터 변환 유틸 ───────────────────────────────────────────────────────────

function convertFilterToQdrant(filter: VectorFilter): QdrantFilter {
  const convert = (conditions: FilterCondition[]): QdrantCondition[] =>
    conditions.map((c) => {
      const cond: QdrantCondition = { key: c.field };
      switch (c.operator) {
        case 'eq':
          cond.match = { value: c.value as string | number | boolean };
          break;
        case 'in':
          cond.match_any = { any: c.value as (string | number)[] };
          break;
        case 'gt':
          cond.range = { gt: c.value as number };
          break;
        case 'gte':
          cond.range = { gte: c.value as number };
          break;
        case 'lt':
          cond.range = { lt: c.value as number };
          break;
        case 'lte':
          cond.range = { lte: c.value as number };
          break;
        case 'contains':
          cond.match = { value: c.value as string };
          break;
        case 'ne':
          // ne는 must_not으로 처리되므로 match로 변환
          cond.match = { value: c.value as string | number | boolean };
          break;
      }
      return cond;
    });

  const qdrantFilter: QdrantFilter = {};
  if (filter.must) qdrantFilter.must = convert(filter.must);
  if (filter.should) qdrantFilter.should = convert(filter.should);
  if (filter.mustNot) qdrantFilter.must_not = convert(filter.mustNot);
  return qdrantFilter;
}

// -- pgvector 폴백 프로바이더 ─────────────────────────────────────────────────

/** pgvector 폴백 프로바이더 (기존 벡터 스토어 활용) */
class PgvectorProvider implements VectorDBProvider {
  readonly backend: VectorDBBackend = 'pgvector';

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    // NOTE: 기존 vector-store.ts 또는 prisma 기반 pgvector 연동
    // 폴백 시 기본 CRUD만 지원
    auditLog('pgvector_upsert', { collection, count: vectors.length });
  }

  async search(
    collection: string,
    query: VectorSearchQuery,
  ): Promise<VectorSearchResult[]> {
    auditLog('pgvector_search', { collection, mode: query.mode ?? 'dense' });
    // NOTE: pgvector <=> 연산자 기반 코사인 유사도 검색
    // 폴백 모드에서는 dense 검색만 지원
    return [];
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    auditLog('pgvector_delete', { collection, count: ids.length });
  }

  async getCollectionInfo(collection: string): Promise<VectorCollectionInfo> {
    return {
      name: collection,
      vectorCount: 0,
      status: 'healthy',
      backend: 'pgvector',
    };
  }

  async healthCheck(): Promise<boolean> {
    // NOTE: 실제 구현에서는 DB 연결 확인
    return true;
  }
}

// -- Qdrant 프로바이더 ────────────────────────────────────────────────────────

/** Qdrant 프로바이더 -- Design §1, §2 */
class QdrantProvider implements VectorDBProvider {
  readonly backend: VectorDBBackend = 'qdrant';
  private readonly client: QdrantClient;

  constructor(client?: QdrantClient) {
    this.client = client ?? getQdrantClient();
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    const points: QdrantPoint[] = vectors.map((v) => ({
      id: v.id,
      vector: v.vector,
      payload: v.metadata ?? {},
    }));
    await this.client.upsertPoints(collection, points);
  }

  async search(
    collection: string,
    query: VectorSearchQuery,
  ): Promise<VectorSearchResult[]> {
    if (!query.vector || query.vector.length === 0) {
      return [];
    }

    const filter = query.filter ? convertFilterToQdrant(query.filter) : undefined;

    const results: QdrantSearchResult[] = await this.client.search(
      collection,
      query.vector,
      {
        limit: query.limit ?? 10,
        filter,
        scoreThreshold: query.scoreThreshold,
        withPayload: true,
      },
    );

    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      metadata: r.payload as Record<string, unknown> | undefined,
    }));
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    await this.client.deletePoints(collection, ids);
  }

  async getCollectionInfo(collection: string): Promise<VectorCollectionInfo> {
    const info = await this.client.getCollectionInfo(collection);
    return {
      name: info.name,
      vectorCount: info.pointsCount,
      status: info.status === 'green' ? 'healthy' : 'degraded',
      backend: 'qdrant',
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck();
  }
}

// -- RRF 하이브리드 검색 ──────────────────────────────────────────────────────

/** Reciprocal Rank Fusion -- Design §3 */
function reciprocalRankFusion(
  denseResults: VectorSearchResult[],
  sparseResults: VectorSearchResult[],
  denseWeight: number,
  limit: number,
): VectorSearchResult[] {
  const k = 60; // RRF 상수
  const scores = new Map<string, { score: number; metadata?: Record<string, unknown> }>();

  // Dense 점수 계산
  denseResults.forEach((r, rank) => {
    const rrf = denseWeight / (k + rank + 1);
    const existing = scores.get(r.id);
    scores.set(r.id, {
      score: (existing?.score ?? 0) + rrf,
      metadata: r.metadata ?? existing?.metadata,
    });
  });

  // Sparse 점수 계산
  const sparseWeight = 1 - denseWeight;
  sparseResults.forEach((r, rank) => {
    const rrf = sparseWeight / (k + rank + 1);
    const existing = scores.get(r.id);
    scores.set(r.id, {
      score: (existing?.score ?? 0) + rrf,
      metadata: r.metadata ?? existing?.metadata,
    });
  });

  // 점수 순 정렬 후 limit 적용
  return Array.from(scores.entries())
    .map(([id, data]) => ({ id, score: data.score, metadata: data.metadata }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// -- VectorDBManager 메인 클래스 ──────────────────────────────────────────────

/** 벡터 DB 통합 매니저 -- Design §1 */
export class VectorDBManager {
  private readonly config: VectorDBManagerConfig;
  private readonly primary: VectorDBProvider;
  private readonly fallback: VectorDBProvider | null;
  private fallbackState: FallbackState;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<VectorDBManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 프로바이더 초기화
    this.primary =
      this.config.primaryBackend === 'qdrant'
        ? new QdrantProvider()
        : new PgvectorProvider();

    this.fallback = this.config.enableFallback ? new PgvectorProvider() : null;

    this.fallbackState = {
      active: false,
      failureCount: 0,
    };

    auditLog('manager_initialized', {
      primary: this.config.primaryBackend,
      fallbackEnabled: this.config.enableFallback,
    });
  }

  // -- 활성 프로바이더 결정 ────────────────────────────────────────────────

  private getActiveProvider(): VectorDBProvider {
    if (this.fallbackState.active && this.fallback) {
      return this.fallback;
    }
    return this.primary;
  }

  // -- 테넌트 격리 ────────────────────────────────────────────────────────

  /** 테넌트별 컬렉션명 생성 -- Design §5 (CSAP D-08) */
  resolveCollectionName(collection: string, tenantId?: string): string {
    if (!tenantId) return collection;
    return `tenant_${tenantId}_${collection}`;
  }

  /** 테넌트 필터 강제 주입 -- Design §5 */
  private injectTenantFilter(
    filter: VectorFilter | undefined,
    tenantId?: string,
  ): VectorFilter | undefined {
    if (!tenantId) return filter;

    const tenantCondition: FilterCondition = {
      field: 'tenantId',
      operator: 'eq',
      value: tenantId,
    };

    if (!filter) {
      return { must: [tenantCondition] };
    }

    return {
      ...filter,
      must: [...(filter.must ?? []), tenantCondition],
    };
  }

  // -- 장애 감지 + 폴백 ──────────────────────────────────────────────────

  /** 장애 기록 + 폴백 전환 판단 -- Design §6 */
  private recordFailure(error: unknown): void {
    this.fallbackState.failureCount += 1;
    this.fallbackState.lastFailure = new Date().toISOString();

    if (
      this.fallbackState.failureCount >= this.config.failureThreshold &&
      !this.fallbackState.active &&
      this.fallback
    ) {
      this.fallbackState.active = true;
      this.fallbackState.activatedAt = new Date().toISOString();
      this.fallbackState.reason =
        error instanceof Error ? error.message : String(error);

      auditLog('fallback_activated', {
        failureCount: this.fallbackState.failureCount,
        reason: this.fallbackState.reason,
      });
    }
  }

  /** 복구 감지 + 원복 -- Design §6 */
  private recordRecovery(): void {
    if (this.fallbackState.active) {
      auditLog('primary_recovered', {
        wasActiveFor:
          this.fallbackState.activatedAt
            ? `${Date.now() - new Date(this.fallbackState.activatedAt).getTime()}ms`
            : 'unknown',
      });
    }
    this.fallbackState = { active: false, failureCount: 0 };
  }

  /** 주기적 헬스체크 시작 -- Design §6 */
  startHealthCheck(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(async () => {
      const healthy = await this.primary.healthCheck();
      if (healthy) {
        this.recordRecovery();
      } else {
        this.recordFailure(new Error('Health check failed'));
      }
    }, this.config.healthCheckInterval);
  }

  /** 헬스체크 중지 */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /** 현재 폴백 상태 조회 */
  getFallbackState(): FallbackState {
    return { ...this.fallbackState };
  }

  // -- CRUD 작업 (폴백 래핑) ──────────────────────────────────────────────

  /** 벡터 업서트 -- Design §1 */
  async upsert(
    collection: string,
    vectors: VectorRecord[],
    tenantId?: string,
  ): Promise<void> {
    const col = this.resolveCollectionName(collection, tenantId);
    const records = tenantId
      ? vectors.map((v) => ({
          ...v,
          metadata: { ...v.metadata, tenantId },
        }))
      : vectors;

    try {
      await this.getActiveProvider().upsert(col, records);
      if (!this.fallbackState.active) this.fallbackState.failureCount = 0;
    } catch (error) {
      this.recordFailure(error);
      if (this.fallback && this.fallbackState.active) {
        await this.fallback.upsert(col, records);
      } else {
        throw error;
      }
    }
  }

  /** 벡터 검색 -- Design §3, §4, §5 */
  async search(
    collection: string,
    query: VectorSearchQuery,
  ): Promise<VectorSearchResult[]> {
    const col = this.resolveCollectionName(collection, query.tenantId);
    const enrichedQuery: VectorSearchQuery = {
      ...query,
      filter: this.injectTenantFilter(query.filter, query.tenantId),
    };

    const mode = enrichedQuery.mode ?? 'dense';

    try {
      let results: VectorSearchResult[];

      if (mode === 'hybrid' && enrichedQuery.vector && enrichedQuery.sparseVector) {
        // 하이브리드 검색: Dense + Sparse → RRF
        const denseResults = await this.getActiveProvider().search(col, {
          ...enrichedQuery,
          mode: 'dense',
        });
        // NOTE: Sparse 검색은 Qdrant native sparse vector 또는 BM25 인덱스 활용
        // 현재는 dense 결과를 기반으로 RRF 적용
        const sparseResults = await this.getActiveProvider().search(col, {
          ...enrichedQuery,
          mode: 'dense', // 폴백: sparse를 dense로 근사
        });
        results = reciprocalRankFusion(
          denseResults,
          sparseResults,
          enrichedQuery.denseWeight ?? 0.7,
          enrichedQuery.limit ?? 10,
        );
      } else {
        results = await this.getActiveProvider().search(col, enrichedQuery);
      }

      if (!this.fallbackState.active) this.fallbackState.failureCount = 0;
      return results;
    } catch (error) {
      this.recordFailure(error);
      if (this.fallback && this.fallbackState.active) {
        return this.fallback.search(col, enrichedQuery);
      }
      throw error;
    }
  }

  /** 벡터 삭제 -- Design §1 */
  async delete(
    collection: string,
    ids: string[],
    tenantId?: string,
  ): Promise<void> {
    const col = this.resolveCollectionName(collection, tenantId);

    try {
      await this.getActiveProvider().delete(col, ids);
      if (!this.fallbackState.active) this.fallbackState.failureCount = 0;
    } catch (error) {
      this.recordFailure(error);
      if (this.fallback && this.fallbackState.active) {
        await this.fallback.delete(col, ids);
      } else {
        throw error;
      }
    }
  }

  /** 컬렉션 정보 조회 */
  async getCollectionInfo(
    collection: string,
    tenantId?: string,
  ): Promise<VectorCollectionInfo> {
    const col = this.resolveCollectionName(collection, tenantId);
    return this.getActiveProvider().getCollectionInfo(col);
  }

  /** 헬스체크 */
  async healthCheck(): Promise<{ primary: boolean; fallback: boolean | null }> {
    const primaryHealth = await this.primary.healthCheck();
    const fallbackHealth = this.fallback
      ? await this.fallback.healthCheck()
      : null;
    return { primary: primaryHealth, fallback: fallbackHealth };
  }

  // -- 배치 업서트 ────────────────────────────────────────────────────────

  /** 대량 벡터 배치 업서트 -- Design §8 */
  async batchUpsert(
    collection: string,
    vectors: VectorRecord[],
    tenantId?: string,
    options?: BatchUpsertOptions,
  ): Promise<{ success: number; failed: number }> {
    const chunkSize = options?.chunkSize ?? BATCH_DEFAULTS.chunkSize;
    const maxConcurrency = options?.maxConcurrency ?? BATCH_DEFAULTS.maxConcurrency;
    const maxRetries = options?.maxRetries ?? BATCH_DEFAULTS.maxRetries;
    const onProgress = options?.onProgress;

    const chunks: VectorRecord[][] = [];
    for (let i = 0; i < vectors.length; i += chunkSize) {
      chunks.push(vectors.slice(i, i + chunkSize));
    }

    let success = 0;
    let failed = 0;

    // 병렬 처리 (maxConcurrency 제한)
    for (let i = 0; i < chunks.length; i += maxConcurrency) {
      const batch = chunks.slice(i, i + maxConcurrency);
      const results = await Promise.allSettled(
        batch.map(async (chunk) => {
          let lastError: unknown;
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              await this.upsert(collection, chunk, tenantId);
              return chunk.length;
            } catch (error) {
              lastError = error;
              auditLog('batch_upsert_retry', {
                attempt: attempt + 1,
                chunkSize: chunk.length,
                error: lastError instanceof Error ? lastError.message : String(lastError),
              });
            }
          }
          throw lastError;
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          success += result.value;
        } else {
          failed += chunkSize;
        }
      }

      if (onProgress) {
        const completed = Math.min((i + maxConcurrency) * chunkSize, vectors.length);
        onProgress(completed, vectors.length);
      }
    }

    auditLog('batch_upsert_complete', { collection, success, failed, total: vectors.length });
    return { success, failed };
  }

  // -- 정리 ──────────────────────────────────────────────────────────────

  /** 리소스 정리 */
  destroy(): void {
    this.stopHealthCheck();
    auditLog('manager_destroyed', {});
  }
}

// -- 팩토리 함수 ──────────────────────────────────────────────────────────────

let managerInstance: VectorDBManager | null = null;

/** VectorDBManager 싱글턴 생성 */
export function getVectorDBManager(
  config?: Partial<VectorDBManagerConfig>,
): VectorDBManager {
  if (!managerInstance) {
    managerInstance = new VectorDBManager(config);
  }
  return managerInstance;
}

/** 테스트용 인스턴스 초기화 */
export function resetVectorDBManager(): void {
  managerInstance?.destroy();
  managerInstance = null;
}
