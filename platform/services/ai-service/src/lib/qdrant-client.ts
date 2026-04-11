// Qdrant 벡터 DB 클라이언트 -- FR-ADV29.2, FR-ADV29.7
// Design Ref: SVC-AI-ADV-R29 DESIGN §2, §7
// Plan SC: SC-1 (검색 성능), SC-4 (FR 전수 구현)
// CSAP: D-09 전송 암호화 (TLS), D-08 인증 토큰 보호

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** Qdrant 연결 설정 */
export interface QdrantConfig {
  /** Qdrant 서버 URL (환경 변수 QDRANT_URL) */
  url: string;
  /** API 키 (환경 변수 QDRANT_API_KEY, 선택) */
  apiKey?: string;
  /** 요청 타임아웃 (ms) */
  timeout: number;
}

/** HNSW 인덱스 설정 -- Design §7 */
export interface HnswConfig {
  /** 구축 시 탐색 이웃 수 (기본 128) */
  efConstruct: number;
  /** 그래프 연결 수 (기본 16) */
  m: number;
  /** 검색 시 탐색 이웃 수 (기본 64) */
  ef: number;
}

/** 컬렉션 설정 */
export interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
  hnsw?: Partial<HnswConfig>;
  onDisk?: boolean;
}

/** 컬렉션 정보 */
export interface CollectionInfo {
  name: string;
  vectorsCount: number;
  pointsCount: number;
  status: 'green' | 'yellow' | 'red';
  optimizerStatus: string;
  config: {
    vectorSize: number;
    distance: string;
    hnsw: HnswConfig;
  };
}

/** 벡터 포인트 */
export interface QdrantPoint {
  id: string | number;
  vector: number[] | Record<string, number[]>;
  payload?: Record<string, unknown>;
}

/** 검색 결과 */
export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
  vector?: number[];
}

/** 필터 조건 -- Design §4 */
export interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

/** 필터 조건 항목 */
export interface QdrantCondition {
  key: string;
  match?: { value: string | number | boolean };
  match_any?: { any: (string | number)[] };
  range?: { gte?: number; lte?: number; gt?: number; lt?: number };
}

/** 스크롤 응답 */
export interface ScrollResponse {
  points: QdrantPoint[];
  nextPageOffset?: string | number | null;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_HNSW: HnswConfig = {
  efConstruct: 128,
  m: 16,
  ef: 64,
};

const DEFAULT_TIMEOUT = 10_000;

// -- Qdrant 클라이언트 ────────────────────────────────────────────────────────

/** Qdrant REST API 클라이언트 -- Design §2 */
export class QdrantClient {
  private readonly config: QdrantConfig;

  constructor(config?: Partial<QdrantConfig>) {
    const url = config?.url ?? process.env.QDRANT_URL;
    if (!url) {
      throw new Error('QDRANT_URL 환경 변수 누락: Qdrant 서버 URL 필수');
    }
    this.config = {
      url: url.replace(/\/+$/, ''),
      apiKey: config?.apiKey ?? process.env.QDRANT_API_KEY,
      timeout: config?.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  // -- HTTP 유틸 ──────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['api-key'] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.url}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Qdrant API 오류 [${response.status}]: ${errorBody}`,
        );
      }

      const result = await response.json();
      return (result as { result?: T }).result ?? (result as T);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -- 헬스체크 ───────────────────────────────────────────────────────────

  /** 서버 상태 확인 -- Design §6 폴백 판단용 */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<unknown>('GET', '/healthz');
      return true;
    } catch {
      return false;
    }
  }

  // -- 컬렉션 관리 ────────────────────────────────────────────────────────

  /** 컬렉션 생성 -- Design §2 */
  async createCollection(config: CollectionConfig): Promise<void> {
    const hnsw = { ...DEFAULT_HNSW, ...config.hnsw };
    await this.request('PUT', `/collections/${config.name}`, {
      vectors: {
        size: config.vectorSize,
        distance: config.distance,
        on_disk: config.onDisk ?? false,
        hnsw_config: {
          ef_construct: hnsw.efConstruct,
          m: hnsw.m,
        },
      },
      hnsw_config: {
        ef_construct: hnsw.efConstruct,
        m: hnsw.m,
      },
    });
  }

  /** 컬렉션 삭제 */
  async deleteCollection(name: string): Promise<void> {
    await this.request('DELETE', `/collections/${name}`);
  }

  /** 컬렉션 정보 조회 */
  async getCollectionInfo(name: string): Promise<CollectionInfo> {
    return this.request<CollectionInfo>('GET', `/collections/${name}`);
  }

  /** 컬렉션 목록 조회 */
  async listCollections(): Promise<string[]> {
    const result = await this.request<{ collections: { name: string }[] }>(
      'GET',
      '/collections',
    );
    return result.collections.map((c) => c.name);
  }

  /** 컬렉션 존재 여부 확인 */
  async collectionExists(name: string): Promise<boolean> {
    try {
      await this.getCollectionInfo(name);
      return true;
    } catch {
      return false;
    }
  }

  // -- 포인트(벡터) CRUD ──────────────────────────────────────────────────

  /** 벡터 업서트 -- Design §8 */
  async upsertPoints(
    collection: string,
    points: QdrantPoint[],
  ): Promise<void> {
    await this.request('PUT', `/collections/${collection}/points`, {
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload ?? {},
      })),
    });
  }

  /** 벡터 삭제 */
  async deletePoints(
    collection: string,
    ids: (string | number)[],
  ): Promise<void> {
    await this.request('POST', `/collections/${collection}/points/delete`, {
      points: ids,
    });
  }

  /** 벡터 조회 */
  async getPoints(
    collection: string,
    ids: (string | number)[],
  ): Promise<QdrantPoint[]> {
    return this.request<QdrantPoint[]>(
      'POST',
      `/collections/${collection}/points`,
      { ids, with_payload: true, with_vector: true },
    );
  }

  // -- 검색 ──────────────────────────────────────────────────────────────

  /** 벡터 유사도 검색 -- Design §3 */
  async search(
    collection: string,
    vector: number[],
    options: {
      limit?: number;
      filter?: QdrantFilter;
      scoreThreshold?: number;
      withPayload?: boolean;
      withVector?: boolean;
      params?: { ef?: number };
    } = {},
  ): Promise<QdrantSearchResult[]> {
    return this.request<QdrantSearchResult[]>(
      'POST',
      `/collections/${collection}/points/search`,
      {
        vector,
        limit: options.limit ?? 10,
        filter: options.filter,
        score_threshold: options.scoreThreshold,
        with_payload: options.withPayload ?? true,
        with_vector: options.withVector ?? false,
        params: options.params ? { ef: options.params.ef } : undefined,
      },
    );
  }

  /** 스크롤 페이지네이션 조회 */
  async scroll(
    collection: string,
    options: {
      filter?: QdrantFilter;
      limit?: number;
      offset?: string | number | null;
      withPayload?: boolean;
      withVector?: boolean;
    } = {},
  ): Promise<ScrollResponse> {
    return this.request<ScrollResponse>(
      'POST',
      `/collections/${collection}/points/scroll`,
      {
        filter: options.filter,
        limit: options.limit ?? 100,
        offset: options.offset,
        with_payload: options.withPayload ?? true,
        with_vector: options.withVector ?? false,
      },
    );
  }

  // -- 인덱스 최적화 ─────────────────────────────────────────────────────

  /** HNSW 파라미터 자동 튜닝 -- Design §7 */
  optimizeHnswParams(vectorCount: number, memoryLimitMb?: number): HnswConfig {
    let efConstruct = 128;
    let m = 16;
    let ef = 64;

    // 벡터 수 기반 조정
    if (vectorCount > 1_000_000) {
      efConstruct = 256;
      m = 24;
      ef = 128;
    } else if (vectorCount > 100_000) {
      efConstruct = 192;
      m = 20;
      ef = 96;
    } else if (vectorCount < 10_000) {
      efConstruct = 64;
      m = 12;
      ef = 32;
    }

    // 메모리 제약 시 보수적 설정
    if (memoryLimitMb && memoryLimitMb < 2048) {
      m = Math.min(m, 12);
      efConstruct = Math.min(efConstruct, 128);
    }

    return { efConstruct, m, ef };
  }

  /** 컬렉션 HNSW 설정 업데이트 */
  async updateCollectionHnsw(
    collection: string,
    hnsw: Partial<HnswConfig>,
  ): Promise<void> {
    await this.request('PATCH', `/collections/${collection}`, {
      hnsw_config: {
        ef_construct: hnsw.efConstruct,
        m: hnsw.m,
      },
    });
  }
}

// -- 팩토리 함수 ──────────────────────────────────────────────────────────────

/** Qdrant 클라이언트 생성 (싱글턴 패턴) */
let instance: QdrantClient | null = null;

export function getQdrantClient(config?: Partial<QdrantConfig>): QdrantClient {
  if (!instance) {
    instance = new QdrantClient(config);
  }
  return instance;
}

/** 테스트용 인스턴스 초기화 */
export function resetQdrantClient(): void {
  instance = null;
}
