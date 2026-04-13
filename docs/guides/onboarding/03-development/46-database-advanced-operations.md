# 46. PostgreSQL 고급 운영 — 성능 튜닝, VACUUM, 통계, 연결 풀링, pgBouncer, CNPG

> **대상 독자**: PostgreSQL 기본 사용 경험이 있는 개발자 및 운영자
> **학습 목표**: 공공기관 SaaS 환경에서 PostgreSQL을 안정적이고 고성능으로 운영하는 방법 습득
> **소요 시간**: 약 3~4시간
> **관련 설계 문서**: `SVC-AI-2026 DESIGN §1`, `SVC-AI-ADV-R1 DESIGN §6`

---

## 목차

1. [PostgreSQL 운영 생태계 개요](#1-postgresql-운영-생태계-개요)
2. [실제 코드 분석 — vector-store.ts](#2-실제-코드-분석--vector-storets)
3. [실제 코드 분석 — rag-engine.ts](#3-실제-코드-분석--rag-enginets)
4. [EXPLAIN ANALYZE 해석법](#4-explain-analyze-해석법)
5. [VACUUM 전략](#5-vacuum-전략)
6. [PostgreSQL 통계 수집](#6-postgresql-통계-수집)
7. [연결 풀링 — pgBouncer vs pgx](#7-연결-풀링--pgbouncer-vs-pgx)
8. [CNPG 클러스터 운영](#8-cnpg-클러스터-운영)
9. [인덱스 최적화](#9-인덱스-최적화)
10. [멀티테넌트 DB 격리 — RLS 정책](#10-멀티테넌트-db-격리--rls-정책)
11. [성능 병목 진단 플로우차트](#11-성능-병목-진단-플로우차트)

---

## 1. PostgreSQL 운영 생태계 개요

PostgreSQL은 단순한 데이터 저장소가 아닙니다. 공공기관 SaaS 환경에서 PostgreSQL은 멀티테넌트 데이터 격리, 벡터 검색(RAG), 감사 로그, 사용자 인증 데이터를 모두 담당합니다. 이 모든 역할을 안정적으로 수행하려면 운영 생태계 전반을 이해해야 합니다.

### 1.1 운영 생태계 다이어그램

```mermaid
graph TD
    subgraph 클라이언트_레이어["클라이언트 레이어"]
        APP["애플리케이션\n(Node.js/Fastify)"]
        PRISMA["Prisma ORM\n(쿼리 빌더)"]
    end

    subgraph 연결_풀_레이어["연결 풀 레이어"]
        PGBOUNCER["PgBouncer\n(세션 풀링)"]
        PGXPOOL["pgx Pool\n(Go 클라이언트)"]
    end

    subgraph CNPG["CNPG 클러스터 (CloudNative-PG)"]
        PRIMARY["Primary\n(읽기/쓰기)"]
        REPLICA1["Replica 1\n(읽기 전용)"]
        REPLICA2["Replica 2\n(읽기 전용)"]
        WAL["WAL 아카이빙\n(Object Storage)"]
    end

    subgraph 쿼리_처리["쿼리 처리 엔진"]
        PARSER["파서\n(SQL 구문 분석)"]
        PLANNER["플래너\n(실행 계획 수립)"]
        EXECUTOR["실행기\n(실제 데이터 접근)"]
        STATS["통계 수집기\n(pg_statistic)"]
    end

    subgraph 스토리지_레이어["스토리지 레이어"]
        HEAP["Heap 파일\n(테이블 데이터)"]
        INDEX["인덱스 파일\n(B-tree/GIN/HNSW)"]
        TOAST["TOAST 저장소\n(대용량 데이터)"]
        WAL_FILES["WAL 파일\n(트랜잭션 로그)"]
    end

    subgraph 백그라운드_작업["백그라운드 프로세스"]
        AUTOVACUUM["AutoVacuum\n(공간 회수)"]
        CHECKPOINTER["체크포인터\n(WAL → 디스크)"]
        BGWRITER["BG Writer\n(더티 페이지 기록)"]
        STATS_COLL["통계 수집기\n(활동 모니터링)"]
    end

    APP --> PRISMA
    PRISMA --> PGBOUNCER
    PGBOUNCER --> PRIMARY
    PGBOUNCER -.->|읽기 분산| REPLICA1
    PGBOUNCER -.->|읽기 분산| REPLICA2
    PRIMARY --> WAL
    PRIMARY --> REPLICA1
    PRIMARY --> REPLICA2

    PRIMARY --> PARSER --> PLANNER --> EXECUTOR
    PLANNER --> STATS
    EXECUTOR --> HEAP
    EXECUTOR --> INDEX
    EXECUTOR --> TOAST
    EXECUTOR --> WAL_FILES

    AUTOVACUUM --> HEAP
    CHECKPOINTER --> WAL_FILES
    BGWRITER --> HEAP
    STATS_COLL --> STATS

    classDef primary fill:#2E7D32,color:#fff
    classDef replica fill:#1565C0,color:#fff
    classDef pool fill:#E65100,color:#fff
    classDef engine fill:#6A1B9A,color:#fff
    classDef bg fill:#37474F,color:#fff
    class PRIMARY primary
    class REPLICA1,REPLICA2 replica
    class PGBOUNCER,PGXPOOL pool
    class PARSER,PLANNER,EXECUTOR,STATS engine
    class AUTOVACUUM,CHECKPOINTER,BGWRITER,STATS_COLL bg
```

### 1.2 왜 고급 운영이 필요한가

공공기관 SaaS의 데이터베이스는 일반 애플리케이션과 다른 특수 요건이 있습니다.

| 요건 | 내용 | 관련 기술 |
|------|------|----------|
| 데이터 격리 | 테넌트 간 완전한 데이터 분리 | Row Level Security (RLS) |
| 감사 로그 | 모든 민감 작업 1년 이상 보관 | append-only 테이블, VACUUM 설정 |
| 벡터 검색 | RAG 지식베이스 유사도 검색 | pgvector, HNSW/IVFFlat 인덱스 |
| 고가용성 | Primary 장애 시 자동 전환 | CNPG, WAL 아카이빙 |
| 성능 | 동시 수백 테넌트 요청 처리 | 연결 풀링, 쿼리 최적화 |

---

## 2. 실제 코드 분석 — vector-store.ts

실제 프로젝트의 `/platform/services/ai-service/src/lib/vector-store.ts` 파일을 분석합니다. 이 파일은 RAG 지식베이스의 핵심 저장/검색 로직을 담당합니다.

### 2.1 파일 구조 개요

```
vector-store.ts
├── VectorDocument 인터페이스  — 청크 데이터 구조 정의
├── SearchResult 인터페이스   — 검색 결과 구조 정의
├── cosineSimilarity()        — 벡터 유사도 계산 (순수 TypeScript)
├── storeChunks()             — 청크 저장 (임베딩 JSON 직렬화)
├── semanticSearch()          — 의미 검색 (테넌트 격리 포함)
└── getKnowledgeStats()       — 지식베이스 통계
```

### 2.2 데이터 저장 구조 분석

`VectorDocument` 인터페이스를 보면 중요한 설계 결정이 있습니다.

```typescript
// Design Ref: SVC-AI-2026 DESIGN §1
// Plan SC: FR-AI26.1
export interface VectorDocument {
  id: string;
  tenantId: string;      // 핵심: 테넌트 격리 키
  documentId: string;    // 원본 문서 참조
  chunkIndex: number;    // 청크 순서 (0-based)
  content: string;       // 실제 텍스트 내용
  embedding: number[];   // 벡터 임베딩 (1536차원 등)
  tokenCount: number;    // 토큰 수 (컨텍스트 예산 계산용)
  metadata: Record<string, unknown>;  // 확장 메타데이터
}
```

**설계 포인트**: `embeddingJson: JSON.stringify(c.embedding)` 로 저장되고 검색 시 `JSON.parse`로 복원합니다. 이는 pgvector 확장 없이도 작동하는 **순수 TypeScript 구현**입니다.

```
현재 구현: PostgreSQL JSON 컬럼 → 전수 로드 → TypeScript 코사인 유사도
향후 계획: pgvector 확장 → HNSW 인덱스 → SQL 내 KNN 검색
```

이 전략은 초기 개발 단계에서 유효하지만, 청크 수가 10,000개를 넘으면 성능 한계가 있습니다.

### 2.3 테넌트 격리 패턴 분석

`semanticSearch()` 함수의 WHERE 절을 보십시오.

```typescript
// Design Ref: SVC-AI-2026 DESIGN §1 — 테넌트 격리
const chunks = await db['aiKnowledgeChunk'].findMany({
  where: {
    tenantId,                          // 반드시 tenantId로 필터
    document: { isActive: true },      // 비활성 문서 제외
  },
  include: {
    document: { select: { title: true, sourceUrl: true } }
  },
  take: 10000,   // 메모리 보호: 최대 10k 청크
});
```

이 코드에서 핵심은 `tenantId` 필터입니다. 테넌트 A의 질문이 테넌트 B의 문서를 검색할 수 없도록 **애플리케이션 레벨에서 격리**합니다. 이후 설명할 RLS(Row Level Security)와 결합하면 이중 격리가 됩니다.

### 2.4 코사인 유사도 — 수식과 구현 대조

코사인 유사도는 두 벡터가 얼마나 같은 방향을 가리키는지 측정합니다. 값이 1에 가까울수록 유사한 의미를 가집니다.

**수식**:
```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

**실제 구현**:
```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  // 길이가 다른 벡터는 비교 불가
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;  // 내적 (분자)
  let normA = 0;       // ||A||² (분모 부분)
  let normB = 0;       // ||B||² (분모 부분)

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;  // 내적 누적
    normA += ai * ai;       // 제곱합 누적
    normB += bi * bi;
  }

  if (normA === 0 || normB === 0) return 0;  // 영벡터 처리
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**초급자 설명**: 임베딩 벡터는 텍스트의 "의미 좌표"입니다. "공공기관 데이터"와 "정부 기관 정보"는 비슷한 의미이므로 코사인 유사도가 0.9에 가깝습니다. "데이터베이스"와 "점심 메뉴"는 유사도가 0.1 이하입니다.

### 2.5 pgvector로 마이그레이션 계획 (현재 미적용, 향후 예정)

현재 구현의 한계와 pgvector 전환 시 얻는 이점을 비교합니다.

```
현재 (JSON 컬럼 + TypeScript 계산):
- 장점: pgvector 설치 불필요, 빠른 개발
- 단점: 10k 청크 초과 시 메모리 부담, SQL 레벨 인덱싱 불가

pgvector 전환 후:
- 장점: HNSW 인덱스로 수백만 벡터도 밀리초 검색
- 단점: PostgreSQL 확장 설치 필요, CNPG 이미지 커스터마이징 필요
```

**pgvector 마이그레이션 시 스키마**:
```sql
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 임베딩 컬럼 추가 (1536차원 = OpenAI text-embedding-ada-002 기준)
ALTER TABLE "AiKnowledgeChunk"
  ADD COLUMN embedding vector(1536);

-- HNSW 인덱스 — 고속 근사 최근접 이웃 검색
-- m: 연결 수 (기본 16), ef_construction: 인덱스 품질 (기본 64)
CREATE INDEX ai_chunk_hnsw_idx
  ON "AiKnowledgeChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- IVFFlat 인덱스 — 대용량 데이터셋 대안
-- lists: 클러스터 수 (권장: sqrt(row_count))
CREATE INDEX ai_chunk_ivfflat_idx
  ON "AiKnowledgeChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**HNSW vs IVFFlat 선택 기준**:

| 항목 | HNSW | IVFFlat |
|------|------|---------|
| 검색 정확도 | 매우 높음 | 높음 |
| 검색 속도 | 빠름 | 더 빠름 (대용량) |
| 인덱스 빌드 시간 | 느림 | 빠름 |
| 메모리 사용량 | 높음 | 낮음 |
| 권장 데이터 수 | 1k ~ 500k | 100k ~ 수백만 |
| 공공 SaaS 선택 | **권장** (정확도 우선) | 대규모 전환 시 |

### 2.6 tenantId 필터 + pgvector 결합 쿼리 (미래 구현)

```sql
-- 테넌트 격리 + 벡터 유사도 검색 결합
SELECT
  c.id,
  c."tenantId",
  c.content,
  c."chunkIndex",
  c."tokenCount",
  1 - (c.embedding <=> $1::vector) AS score,  -- 코사인 유사도
  d.title AS "documentTitle"
FROM "AiKnowledgeChunk" c
JOIN "AiKnowledgeDocument" d ON c."documentId" = d.id
WHERE
  c."tenantId" = $2           -- 테넌트 격리 필터
  AND d."isActive" = true     -- 비활성 문서 제외
ORDER BY c.embedding <=> $1::vector  -- KNN 정렬
LIMIT $3;                     -- topK 제한

-- 실행 계획 예시 (EXPLAIN ANALYZE):
-- Index Scan using ai_chunk_hnsw_idx on AiKnowledgeChunk
--   Index Cond: (embedding <=> '[0.1, 0.2, ...]'::vector)
--   Filter: (tenantId = 'tenant-uuid' AND isActive = true)
```

---

## 3. 실제 코드 분석 — rag-engine.ts

`/platform/services/ai-service/src/lib/rag-engine.ts`는 RAG 파이프라인의 오케스트레이터 역할을 합니다. 검색부터 LLM 답변 생성까지 전체 흐름을 제어합니다.

### 3.1 RAG 파이프라인 아키텍처

```mermaid
flowchart LR
    subgraph 입력["입력 처리"]
        Q["질문 텍스트"]
        QE["임베딩 생성\ngenerateEmbedding()"]
        QX["쿼리 확장\nexpandQuery() - 선택"]
    end

    subgraph 검색["검색 단계"]
        SEM["시맨틱 검색\nsemanticSearch()"]
        BM25["BM25 키워드 검색\nhybridSearch()"]
        RRF["RRF 융합\nReciprocal Rank Fusion"]
        RERANK["LLM Reranking\nrerankResults() - 선택"]
    end

    subgraph 컨텍스트["컨텍스트 구성"]
        BUDGET["토큰 예산 관리\nmaxContextTokens=6000"]
        COMPRESS["컨텍스트 압축\nenableCompression - 선택"]
        CTX["컨텍스트 텍스트\n[문서명, 청크인덱스]"]
    end

    subgraph 생성["LLM 답변 생성"]
        PII["PII 마스킹\nmaskPII()"]
        LLM["LLM 호출\nprovider.chat()"]
        SRC["출처 인용\n[출처: 문서명] 형식"]
    end

    Q --> QE --> QX
    QX --> SEM
    QX --> BM25
    SEM --> RRF
    BM25 --> RRF
    RRF --> RERANK
    RERANK --> BUDGET
    BUDGET --> COMPRESS
    COMPRESS --> CTX
    CTX --> PII
    PII --> LLM
    LLM --> SRC

    classDef optional fill:#FFF9C4,stroke:#F9A825
    class QX,RERANK,COMPRESS optional
```

### 3.2 청킹 파이프라인 분석

`ai-rag.handler.ts`에서 `chunkText(body.content, 512, 50)` 호출을 볼 수 있습니다.

```typescript
// ragIngestHandler에서 호출
const chunks = chunkText(
  body.content,  // 원본 텍스트 (최대 50만 자)
  512,           // 청크 크기: 512 토큰
  50,            // 오버랩: 50 토큰 (문맥 연속성 유지)
);
```

**청킹 파라미터 이해**:

```
원본 문서: [====================================]  (2000 토큰)
청크 1:   [=======]                              (512 토큰, 위치 0)
청크 2:         [=======]                        (512 토큰, 오버랩 50)
청크 3:               [=======]                  (512 토큰, 오버랩 50)
청크 4:                     [=======]            (512 토큰, 오버랩 50)

오버랩 목적: 청크 경계에서 의미가 잘리는 것 방지
예) "3조 1항에 따르면" → "... 3조 1항에 따르면" (다음 청크에도 포함)
```

**배치 임베딩 처리**:
```typescript
// 모든 청크를 병렬로 임베딩 생성
const chunksWithEmbeddings = await Promise.all(
  chunks.map(async (chunk) => {
    const embedding = await generateEmbedding(
      chunk.content,
      body.embedModelId,  // 테넌트별 임베딩 모델 선택 가능
    );
    return { ...chunk, embedding };
  }),
);
```

주의: `Promise.all`은 모든 청크를 동시에 임베딩합니다. 청크가 많으면 LLM 서버에 부하가 집중됩니다. 실제 운영에서는 `p-limit` 등으로 동시성 제한을 권장합니다.

### 3.3 토큰 예산 관리

```typescript
const { maxContextTokens = 6000 } = options;

for (const result of searchResults) {
  const chunkTokens = result.chunk.tokenCount;

  // 토큰 예산 초과 시 중단 (LLM 컨텍스트 창 보호)
  if (totalContextTokens + chunkTokens > maxContextTokens) break;

  contextText += `\n[문서: ${docTitle}, 청크 ${result.chunk.chunkIndex + 1}]\n${result.chunk.content}\n`;
  totalContextTokens += chunkTokens;
}
```

**왜 토큰 예산이 필요한가**: LLM의 컨텍스트 창(context window)은 유한합니다. 예를 들어 LLaMA-3.1-8B는 128K 토큰을 지원하지만, 컨텍스트가 길수록 응답 속도가 느려지고 비용이 증가합니다. 6,000 토큰은 공공 문서 5~7개 청크를 담을 수 있는 적절한 크기입니다.

### 3.4 Advanced RAG 검색 통계 구조

`AdvancedRAGResponse`의 `retrievalStats`는 성능 모니터링의 핵심입니다.

```typescript
// DB에서 쿼리 최적화 판단 근거
const retrievalStats = {
  bm25Candidates: 0,      // BM25 키워드 검색 결과 수
  semanticCandidates: 0,  // 시맨틱 검색 결과 수
  fusedCandidates: 0,     // RRF 융합 후 후보 수
  rerankCandidates: 0,    // Reranking 후 최종 후보 수
  finalCount: 0,          // 컨텍스트에 포함된 청크 수
};
```

이 통계를 PostgreSQL에 저장하면 나중에 다음을 분석할 수 있습니다.
- 어떤 검색 모드가 더 많은 결과를 생성하는가
- Reranking이 검색 품질을 얼마나 개선하는가
- 어떤 테넌트가 지식베이스를 가장 많이 사용하는가

---

## 4. EXPLAIN ANALYZE 해석법

PostgreSQL에서 쿼리가 느린 이유를 찾으려면 `EXPLAIN ANALYZE`를 사용해야 합니다. 이것은 쿼리의 실행 계획과 실제 실행 시간을 함께 보여주는 도구입니다.

### 4.1 기본 사용법

```sql
-- 기본 EXPLAIN (실제 실행 없이 계획만)
EXPLAIN SELECT * FROM "AiKnowledgeChunk" WHERE "tenantId" = 'uuid-here';

-- EXPLAIN ANALYZE (실제 실행 + 시간 측정)
EXPLAIN ANALYZE SELECT * FROM "AiKnowledgeChunk" WHERE "tenantId" = 'uuid-here';

-- EXPLAIN ANALYZE VERBOSE (상세 정보)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)
  SELECT * FROM "AiKnowledgeChunk"
  WHERE "tenantId" = 'uuid-here'
  AND "tokenCount" > 100;
```

**주의**: `EXPLAIN ANALYZE`는 실제로 쿼리를 실행합니다. `DELETE`나 `UPDATE`에 사용할 때는 트랜잭션으로 감싸십시오.

```sql
BEGIN;
EXPLAIN ANALYZE DELETE FROM "AiKnowledgeChunk" WHERE "documentId" = 'old-doc';
ROLLBACK;  -- 실제 삭제되지 않게 롤백
```

### 4.2 실행 계획 읽는 법

실제 출력 예시:

```
Gather  (cost=1000.00..45678.90 rows=5000 width=1024) (actual time=12.345..234.567 rows=4821 loops=1)
  Workers Planned: 2
  Workers Launched: 2
  ->  Parallel Seq Scan on "AiKnowledgeChunk"
      (cost=0.00..44321.00 rows=2083 width=1024)
      (actual time=0.123..198.456 rows=1607 loops=3)
        Filter: (("tenantId")::text = 'tenant-uuid-here')
        Rows Removed by Filter: 82500
Planning Time: 2.345 ms
Execution Time: 245.678 ms
```

**읽는 포인트**:

| 항목 | 의미 | 위험 신호 |
|------|------|----------|
| `cost=시작..끝` | 플래너 예상 비용 (임의 단위) | 끝 비용이 100만 이상 |
| `actual time=시작..끝` | 실제 실행 시간 (ms) | 끝이 1000ms 이상 |
| `rows=숫자` | 처리된 행 수 | 실제 vs 예상 크게 다를 때 |
| `Seq Scan` | 전수 검색 (느림) | 대용량 테이블에서 발생 시 |
| `Index Scan` | 인덱스 검색 (빠름) | 항상 선호 |
| `Rows Removed by Filter` | 필터에서 제거된 행 | 높으면 인덱스 추가 검토 |

위 예시에서 `Rows Removed by Filter: 82500`은 문제입니다. 82,500개 행을 읽어서 4,821개만 남겼다는 뜻입니다. `tenantId`에 인덱스를 추가하면 훨씬 효율적입니다.

### 4.3 Seq Scan vs Index Scan 결정 기준

```sql
-- 인덱스가 없을 때: Seq Scan 발생
SELECT * FROM "AiKnowledgeChunk" WHERE "tenantId" = 'uuid';

-- 인덱스 추가 후: Index Scan 발생
CREATE INDEX idx_chunk_tenant ON "AiKnowledgeChunk" ("tenantId");

-- EXPLAIN으로 확인
EXPLAIN SELECT * FROM "AiKnowledgeChunk" WHERE "tenantId" = 'uuid';
-- 출력: Index Scan using idx_chunk_tenant ...
```

**PostgreSQL이 Seq Scan을 선택하는 경우**:
1. 테이블이 작아서 인덱스 오버헤드가 더 클 때 (< 1,000행)
2. 전체 행의 30% 이상을 반환할 때 (인덱스 비효율)
3. 통계가 오래되어 플래너가 잘못 판단할 때 → `ANALYZE` 실행 필요

```sql
-- 통계 강제 업데이트
ANALYZE "AiKnowledgeChunk";

-- 또는 전체 DB
ANALYZE;
```

### 4.4 공공 SaaS 핵심 쿼리 최적화 예시

```sql
-- 문제 쿼리: 느린 RAG 지식베이스 통계
EXPLAIN ANALYZE
SELECT COUNT(*), SUM("tokenCount")
FROM "AiKnowledgeChunk"
WHERE "tenantId" = $1;

-- 문제 원인: tenantId 단독 인덱스만 있을 경우
-- tokenCount를 별도로 접근해야 함

-- 해결: 커버링 인덱스 (tokenCount 포함)
CREATE INDEX idx_chunk_tenant_stats
  ON "AiKnowledgeChunk" ("tenantId")
  INCLUDE ("tokenCount");
-- INCLUDE 절: 인덱스에 컬럼 포함 (Index-Only Scan 가능)
```

---

## 5. VACUUM 전략

PostgreSQL은 MVCC(Multi-Version Concurrency Control) 방식으로 데이터를 관리합니다. UPDATE/DELETE를 해도 기존 행은 바로 삭제되지 않고 "죽은 행(dead tuple)"으로 남습니다. VACUUM은 이 죽은 행을 정리하는 작업입니다.

### 5.1 VACUUM이 필요한 이유

```
트랜잭션 흐름:
BEGIN;
UPDATE "User" SET name = '홍길동' WHERE id = '123';  -- 기존 행 = dead tuple
COMMIT;

테이블 상태:
ID=123, name='김민수' (dead, 보이지 않음)
ID=123, name='홍길동' (live, 현재 값)

문제: dead tuple이 쌓이면 테이블이 비대해지고(bloat) 성능 저하 발생
해결: VACUUM으로 dead tuple 정리 → 공간 재사용
```

### 5.2 AutoVacuum 파라미터 설정

공공기관 SaaS에서 각 테이블 유형별로 다른 설정이 필요합니다.

```sql
-- 일반 테이블 (기본 설정 검토)
SHOW autovacuum_vacuum_threshold;    -- 50 (기본: 50행 이상 dead tuple)
SHOW autovacuum_vacuum_scale_factor; -- 0.2 (기본: 테이블 20% dead tuple)
-- autovacuum 발동 조건: threshold + scale_factor * n_live_tup

-- RAG 청크 테이블 (쓰기 집약적 — 빠른 VACUUM 필요)
ALTER TABLE "AiKnowledgeChunk"
  SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- 5%만 dead여도 실행
    autovacuum_vacuum_threshold = 100,
    autovacuum_analyze_scale_factor = 0.02  -- 통계 빠르게 업데이트
  );

-- 감사 로그 테이블 (insert-only — VACUUM 최소화)
-- 감사 로그는 업데이트/삭제가 없으므로 dead tuple이 생기지 않음
ALTER TABLE "AuditLog"
  SET (
    autovacuum_vacuum_scale_factor = 0.5,   -- dead tuple 50%여도 ok
    autovacuum_vacuum_threshold = 10000,    -- 1만 행 이상에서만 실행
    autovacuum_freeze_max_age = 200000000  -- freeze 지연 (insert-only)
  );

-- 세션/토큰 테이블 (만료 데이터 주기적 삭제 → bloat 위험)
ALTER TABLE "Session"
  SET (
    autovacuum_vacuum_scale_factor = 0.01,  -- 1%만 dead여도 실행
    autovacuum_vacuum_threshold = 50,
    autovacuum_vacuum_cost_delay = 5        -- 더 적극적으로 실행
  );
```

### 5.3 Bloat 방지 전략

**Bloat 탐지**:
```sql
-- 테이블 bloat 확인 (pgstattuple 확장 필요)
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  n_dead_tup,
  n_live_tup,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
  last_autovacuum,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC
LIMIT 20;
```

**Bloat 해소**:
```sql
-- 일반 VACUUM (공간 재사용, 잠금 없음)
VACUUM "AiKnowledgeChunk";

-- VACUUM FULL (OS 반환, 잠금 발생 — 운영 시간 외 실행)
VACUUM FULL "AiKnowledgeChunk";

-- VACUUM + 통계 업데이트
VACUUM ANALYZE "AiKnowledgeChunk";

-- 진행 상황 모니터링
SELECT
  pid,
  phase,
  heap_blks_total,
  heap_blks_scanned,
  heap_blks_vacuumed,
  ROUND(100.0 * heap_blks_vacuumed / NULLIF(heap_blks_total, 0), 1) AS pct
FROM pg_stat_progress_vacuum;
```

### 5.4 감사 로그 테이블 전용 VACUUM 전략

감사 로그는 CSAP D-06에 따라 1년 이상 보관해야 합니다. 동시에 성능 저하 없이 운영해야 합니다.

```sql
-- 감사 로그 테이블 파티셔닝 (월별)
-- 이 방법이 가장 효과적인 bloat 방지 전략
CREATE TABLE "AuditLog_2026_04" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- 1년 지난 파티션은 DROP (삭제 즉시 공간 반환, VACUUM 불필요)
DROP TABLE "AuditLog_2025_03";

-- 파티션 자동 생성 (매월 초 실행 예정)
-- pg_partman 확장 또는 CronJob으로 자동화
```

**파티셔닝이 VACUUM보다 나은 이유**:
- 오래된 파티션 DROP = 즉시 공간 반환 (VACUUM FULL 불필요)
- 최근 파티션만 쿼리 → partition pruning으로 속도 향상
- 파티션별 다른 tablespace 설정 가능 (오래된 데이터 → 저속 스토리지)

---

## 6. PostgreSQL 통계 수집

PostgreSQL은 자체적으로 방대한 통계를 수집합니다. 이를 활용하면 성능 문제를 사전에 예방할 수 있습니다.

### 6.1 pg_stat_user_tables — 테이블 활동 모니터링

```sql
-- 핵심 테이블 활동 현황
SELECT
  relname AS "테이블명",
  seq_scan AS "전수검색횟수",
  idx_scan AS "인덱스검색횟수",
  ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS "인덱스사용률(%)",
  n_tup_ins AS "삽입횟수",
  n_tup_upd AS "수정횟수",
  n_tup_del AS "삭제횟수",
  n_live_tup AS "활성행수",
  n_dead_tup AS "죽은행수",
  last_autovacuum::date AS "마지막AutoVACUUM",
  last_autoanalyze::date AS "마지막AutoANALYZE"
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;
```

**해석 방법**:
- `인덱스사용률 < 50%` → 해당 테이블에 인덱스가 부족하거나 잘못된 인덱스가 있음
- `죽은행수 > 활성행수 * 0.2` → VACUUM이 제대로 작동하지 않음
- `마지막AutoVACUUM > 1시간` → autovacuum이 바쁜 테이블 확인 필요

### 6.2 pg_stat_statements — 느린 쿼리 찾기

`pg_stat_statements`는 실행된 쿼리별 통계를 축적합니다. 슬로우 쿼리를 찾는 가장 강력한 도구입니다.

```sql
-- pg_stat_statements 활성화 (postgresql.conf)
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all

-- 확장 설치
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 상위 10개 느린 쿼리
SELECT
  LEFT(query, 100) AS "쿼리(앞100자)",
  calls AS "호출횟수",
  ROUND(mean_exec_time::numeric, 2) AS "평균실행시간(ms)",
  ROUND(total_exec_time::numeric, 2) AS "총실행시간(ms)",
  ROUND(rows / calls, 0) AS "평균행수",
  ROUND(100.0 * total_exec_time / SUM(total_exec_time) OVER(), 2) AS "전체비율(%)"
FROM pg_stat_statements
WHERE calls > 10  -- 10번 이상 호출된 쿼리만
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 6.3 RAG 서비스 특화 모니터링

```sql
-- RAG 지식베이스 테넌트별 사용 통계
SELECT
  "tenantId",
  COUNT(DISTINCT "documentId") AS "문서수",
  COUNT(*) AS "청크수",
  SUM("tokenCount") AS "총토큰수",
  ROUND(AVG("tokenCount"), 0) AS "평균청크크기",
  pg_size_pretty(SUM(octet_length("content"::text))) AS "총콘텐츠크기"
FROM "AiKnowledgeChunk" c
JOIN "AiKnowledgeDocument" d ON c."documentId" = d.id
WHERE d."isActive" = true
GROUP BY c."tenantId"
ORDER BY "총토큰수" DESC;
```

```sql
-- AI 사용량 일별 추이 (최근 30일)
SELECT
  DATE_TRUNC('day', "createdAt") AS "날짜",
  action AS "행동유형",
  COUNT(*) AS "호출수",
  SUM((details->>'tokensUsed')::int) AS "토큰사용량"
FROM "AuditLog"
WHERE
  action IN ('RAG_QUERY', 'RAG_ADVANCED_QUERY', 'AI_CHAT')
  AND "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, "토큰사용량" DESC;
```

### 6.4 연결 수 모니터링

```sql
-- 현재 연결 상태 (pgBouncer 연결 포함)
SELECT
  state AS "상태",
  wait_event_type AS "대기유형",
  wait_event AS "대기이벤트",
  COUNT(*) AS "연결수",
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS "비율(%)"
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY 1, 2, 3
ORDER BY "연결수" DESC;

-- 잠금 대기 쿼리 (성능 문제 진단)
SELECT
  pid,
  age(clock_timestamp(), query_start) AS "실행시간",
  LEFT(query, 80) AS "쿼리(앞80자)",
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE state = 'active'
  AND wait_event_type = 'Lock'
ORDER BY query_start;
```

---

## 7. 연결 풀링 — pgBouncer vs pgx

PostgreSQL은 연결마다 별도 프로세스를 생성합니다. 1,000개의 동시 연결 = 1,000개 프로세스 = 막대한 메모리 사용. 연결 풀링이 필수인 이유입니다.

### 7.1 연결 풀링이 필요한 이유

```
연결 풀링 없이:
클라이언트 100개 → PostgreSQL 100개 연결 → 메모리 약 100MB
클라이언트 1000개 → PostgreSQL 1000개 연결 → 메모리 약 1GB + 성능 저하

pgBouncer 적용 후:
클라이언트 1000개 → PgBouncer → PostgreSQL 20개 연결 → 메모리 약 20MB
```

### 7.2 pgBouncer 동작 모드

| 모드 | 설명 | 사용 사례 |
|------|------|----------|
| Session | 클라이언트 연결 = DB 연결 (1:1) | prepared statements 사용 시 |
| Transaction | 트랜잭션마다 연결 할당 | **권장**: 대부분의 웹 애플리케이션 |
| Statement | 문장마다 연결 할당 | 단일 문장만 사용하는 경우 |

공공 SaaS에서는 **Transaction 모드**를 권장합니다. Prisma ORM과 호환되며 효율이 가장 높습니다.

### 7.3 CNPG 환경에서 PgBouncer 설정

CloudNative-PG(CNPG)는 Kubernetes에서 PostgreSQL을 운영하는 오퍼레이터입니다. PgBouncer는 CNPG의 pooler 리소스로 간단히 설정할 수 있습니다.

```yaml
# platform/infra/cnpg/pgbouncer-pooler.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: ai-service-rw-pooler
  namespace: public-saas
spec:
  cluster:
    name: ai-service-db          # CNPG 클러스터 이름
  instances: 3                   # PgBouncer 인스턴스 수
  type: rw                       # rw: 읽기/쓰기 (Primary로 연결)
  pgbouncer:
    poolMode: transaction        # Transaction 모드
    parameters:
      max_client_conn: "1000"    # 최대 클라이언트 연결 수
      default_pool_size: "25"    # 테넌트당 기본 풀 크기
      reserve_pool_size: "5"     # 예비 연결 수
      reserve_pool_timeout: "3"  # 예비 풀 대기 시간 (초)
      # 공공기관 운영 최적화
      server_idle_timeout: "600"  # 유휴 서버 연결 10분 후 종료
      client_idle_timeout: "0"    # 클라이언트 연결 무제한 유지
      query_wait_timeout: "120"   # 쿼리 대기 최대 2분
      # 로깅 (CSAP D-06 감사)
      log_connections: "1"
      log_disconnections: "1"
      log_pooler_errors: "1"
  template:
    spec:
      containers:
        - name: pgbouncer
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
```

```yaml
# 읽기 전용 Pooler (Replica용)
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: ai-service-ro-pooler
  namespace: public-saas
spec:
  cluster:
    name: ai-service-db
  instances: 2
  type: ro                       # ro: 읽기 전용 (Replica로 연결)
  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "500"
      default_pool_size: "15"
```

### 7.4 Prisma와 PgBouncer 연동

```typescript
// .env — 환경변수 (하드코딩 절대 금지 — CSAP D-09)
// DATABASE_URL은 PgBouncer를 거쳐 PostgreSQL에 연결
// DATABASE_URL="postgresql://user:pass@pgbouncer-svc:5432/db?pgbouncer=true"

// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // PgBouncer Transaction 모드를 위한 필수 설정
  directUrl = env("DATABASE_DIRECT_URL")  // 마이그레이션용 직접 연결
}
```

```typescript
// prisma 클라이언트 설정
// platform/services/ai-service/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env['DATABASE_URL'],
    },
  },
  log: process.env['NODE_ENV'] === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
});

// PgBouncer Transaction 모드 주의사항:
// - prepared statements 사용 불가 (기본 비활성화됨)
// - LISTEN/NOTIFY 사용 불가
// - SET 명령은 트랜잭션 내에서만 유효
// - 세션 레벨 설정은 각 연결마다 재설정 필요
```

---

## 8. CNPG 클러스터 운영

CloudNative-PG(CNPG)는 Kubernetes 네이티브 PostgreSQL 오퍼레이터입니다. 자동 장애 조치, WAL 아카이빙, 백업을 지원합니다.

### 8.1 클러스터 기본 구성

```yaml
# platform/infra/cnpg/ai-service-cluster.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ai-service-db
  namespace: public-saas
spec:
  instances: 3  # Primary 1 + Replica 2

  # PostgreSQL 버전 및 이미지
  imageName: ghcr.io/cloudnative-pg/postgresql:16.2

  # 스토리지 설정
  storage:
    size: 100Gi
    storageClass: standard  # 운영: premium-ssd 또는 nvme

  # PostgreSQL 파라미터 (공공 SaaS 최적화)
  postgresql:
    parameters:
      # 메모리 설정 (워커 노드 RAM의 25%)
      shared_buffers: "2GB"
      effective_cache_size: "6GB"
      work_mem: "64MB"
      maintenance_work_mem: "512MB"
      # WAL 설정
      wal_buffers: "64MB"
      wal_level: "replica"
      max_wal_size: "2GB"
      min_wal_size: "512MB"
      # 연결 설정
      max_connections: "200"
      # 감사 로깅 (CSAP D-06)
      log_statement: "ddl"
      log_min_duration_statement: "1000"  # 1초 이상 쿼리 로깅
      log_checkpoints: "on"
      log_connections: "on"
      log_disconnections: "on"
      log_lock_waits: "on"
      # AutoVacuum 최적화
      autovacuum_max_workers: "5"
      autovacuum_naptime: "30s"
      # pgvector 지원 (향후 활성화)
      # shared_preload_libraries: "vector"

  # WAL 아카이빙 (PITR — 특정 시점 복구)
  backup:
    retentionPolicy: "30d"  # 30일 보관
    barmanObjectStore:
      destinationPath: "s3://public-saas-backup/ai-service-db"
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: backup-credentials
          key: ACCESS_SECRET_KEY

  # 스케줄 백업 (매일 02:00)
  scheduledBackup:
    schedule: "0 2 * * *"
```

### 8.2 Primary/Replica 전환 (Failover)

```bash
# 현재 Primary 확인
kubectl get cluster ai-service-db -n public-saas -o jsonpath='{.status.currentPrimary}'

# 수동 전환 (계획된 유지보수)
kubectl cnpg promote ai-service-db --instance ai-service-db-2

# 전환 후 상태 확인
kubectl get pods -n public-saas -l cnpg.io/cluster=ai-service-db

# CNPG 이벤트 확인
kubectl get events -n public-saas --field-selector reason=PromotingInstance
```

**자동 Failover 흐름**:
```
Primary 장애 감지 (health check 실패)
    ↓
CNPG 오퍼레이터: Replica 중 Failover 후보 선택
    ↓
선택된 Replica → Primary로 승격 (pg_promote() 호출)
    ↓
다른 Replica → 새 Primary로 복제 대상 변경
    ↓
PgBouncer → 새 Primary 엔드포인트로 자동 재연결
    ↓
서비스 재개 (목표: RTO < 30초)
```

### 8.3 WAL 아카이빙 및 PITR

WAL(Write-Ahead Log)은 PostgreSQL의 모든 변경 사항을 순서대로 기록한 로그입니다. 이를 외부 스토리지에 보관하면 어떤 시점으로도 복구 가능합니다.

```bash
# 즉시 백업 생성 (감사 전 스냅샷 등)
kubectl cnpg backup ai-service-db --backup-name "before-audit-2026-04-13"

# 백업 목록 확인
kubectl get backups -n public-saas

# 특정 시점으로 복구 (예: 랜섬웨어 공격 이전으로)
# recovery-cluster.yaml에서 recoveryTarget.targetTime 설정
kubectl apply -f recovery-cluster.yaml
```

---

## 9. 인덱스 최적화

인덱스는 쿼리를 빠르게 만들지만 잘못 사용하면 오히려 성능을 저하시킵니다. 공공 SaaS의 핵심 쿼리 패턴을 분석하고 최적 인덱스를 설계합니다.

### 9.1 복합 인덱스

하나의 인덱스에 여러 컬럼을 포함하는 복합 인덱스는 순서가 매우 중요합니다.

```sql
-- 잘못된 예: 개별 인덱스 2개
CREATE INDEX idx_chunk_tenant ON "AiKnowledgeChunk" ("tenantId");
CREATE INDEX idx_chunk_doc ON "AiKnowledgeChunk" ("documentId");

-- 위 경우: WHERE tenantId = $1 AND documentId = $2
-- PostgreSQL이 두 인덱스를 합쳐서 처리 (Bitmap AND) → 비효율

-- 올바른 예: 복합 인덱스
CREATE INDEX idx_chunk_tenant_doc
  ON "AiKnowledgeChunk" ("tenantId", "documentId");

-- 복합 인덱스는 왼쪽부터 순서대로 사용됨
-- WHERE tenantId = $1 AND documentId = $2 → 사용 가능
-- WHERE tenantId = $1 → 사용 가능 (tenantId만 필터)
-- WHERE documentId = $2 → 사용 불가 (tenantId가 없으므로)
```

**복합 인덱스 컬럼 순서 결정 원칙**:
1. 선택도가 높은(유니크한) 컬럼을 앞에
2. WHERE에서 항상 사용되는 컬럼을 앞에
3. 범위 조건 컬럼은 마지막에

```sql
-- 공공 SaaS 핵심 인덱스 설계
-- 1. RAG 검색용 (tenantId + isActive 복합)
CREATE INDEX idx_chunk_tenant_active
  ON "AiKnowledgeChunk" ("tenantId", "chunkIndex")
  WHERE -- 부분 인덱스: isActive=true인 문서 청크만
  EXISTS (
    SELECT 1 FROM "AiKnowledgeDocument" d
    WHERE d.id = "AiKnowledgeChunk"."documentId"
      AND d."isActive" = true
  );

-- 2. 감사 로그 시간 범위 조회 (tenantId + createdAt)
CREATE INDEX idx_audit_tenant_time
  ON "AuditLog" ("tenantId", "createdAt" DESC);

-- 3. 사용자 이메일 조회 (유니크 + 소문자 정규화)
CREATE UNIQUE INDEX idx_user_email_lower
  ON "User" (lower(email));
```

### 9.2 부분 인덱스

조건을 만족하는 행에 대해서만 인덱스를 생성합니다. 크기가 작고 효율적입니다.

```sql
-- 활성 테넌트만 인덱싱 (비활성 테넌트 제외)
CREATE INDEX idx_tenant_active
  ON "Tenant" (id, "plan")
  WHERE status = 'active';

-- 미처리 큐 작업만 인덱싱 (처리 완료된 건 제외)
CREATE INDEX idx_job_pending
  ON "BackgroundJob" ("createdAt", priority DESC)
  WHERE status IN ('pending', 'processing');

-- 최근 90일 이내 AI 사용 로그만 (전체 중 일부)
CREATE INDEX idx_ai_usage_recent
  ON "AiUsageLog" ("tenantId", "createdAt" DESC)
  WHERE "createdAt" > NOW() - INTERVAL '90 days';
-- 주의: 부분 인덱스 조건은 쿼리 WHERE 절과 정확히 일치해야 사용됨
```

### 9.3 커버링 인덱스

쿼리에 필요한 모든 컬럼을 인덱스에 포함시켜 테이블 접근을 완전히 없애는 기법입니다.

```sql
-- 일반 인덱스: tenantId로 검색 → 인덱스 → 테이블 행으로 이동
CREATE INDEX idx_chunk_tenant ON "AiKnowledgeChunk" ("tenantId");

-- 커버링 인덱스: 모든 필요 컬럼을 인덱스에 포함
-- tokenCount 통계 쿼리: 테이블 접근 불필요 (Index-Only Scan)
CREATE INDEX idx_chunk_tenant_covering
  ON "AiKnowledgeChunk" ("tenantId")
  INCLUDE ("tokenCount", "chunkIndex", "documentId");
-- INCLUDE: 인덱스 키가 아닌 컬럼 추가 (필터/정렬에는 못 쓰지만 데이터는 포함)

-- EXPLAIN ANALYZE 출력:
-- Index Only Scan using idx_chunk_tenant_covering on AiKnowledgeChunk
--   Index Cond: (tenantId = $1)
--   Heap Fetches: 0   ← 테이블 접근 0회!
```

---

## 10. 멀티테넌트 DB 격리 — RLS 정책 최적화

Row Level Security(RLS)는 PostgreSQL의 행 수준 접근 제어입니다. 쿼리 결과에서 현재 사용자 권한에 맞지 않는 행을 자동으로 필터링합니다.

### 10.1 RLS 기본 설정

```sql
-- RLS 활성화
ALTER TABLE "AiKnowledgeChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiKnowledgeDocument" ENABLE ROW LEVEL SECURITY;

-- PostgreSQL 역할 정의
CREATE ROLE app_user;    -- 일반 애플리케이션 역할
CREATE ROLE admin_user;  -- 관리자 역할 (모든 테넌트 접근)

-- 정책: 각 테넌트는 자신의 데이터만 접근
CREATE POLICY tenant_isolation ON "AiKnowledgeChunk"
  FOR ALL
  TO app_user
  USING (
    "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- 관리자는 모든 테넌트 접근 가능
CREATE POLICY admin_access ON "AiKnowledgeChunk"
  FOR ALL
  TO admin_user
  USING (true);  -- 조건 없이 모든 행 접근
```

### 10.2 애플리케이션에서 RLS 컨텍스트 설정

```typescript
// platform/services/ai-service/src/lib/prisma.ts
// RLS와 함께 사용하는 Prisma 미들웨어

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Prisma 미들웨어: 모든 쿼리 전 tenantId 설정
prisma.$use(async (params, next) => {
  const tenantId = AsyncLocalStorage.getStore()?.tenantId;

  if (tenantId) {
    // PostgreSQL 세션 변수 설정 (RLS 정책에서 사용)
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenantId}, true)
    `;
  }

  return next(params);
});
```

### 10.3 RLS 성능 최적화

RLS는 모든 쿼리에 자동으로 필터를 추가합니다. 이 필터가 인덱스를 활용해야 성능이 유지됩니다.

```sql
-- RLS 정책이 사용하는 표현식에 함수 인덱스 추가
-- current_setting()은 함수 호출이므로 직접 인덱싱 불가
-- 대신: tenantId 컬럼에 인덱스 필수

-- ✅ RLS + 인덱스 결합 최적화
-- 1. tenantId 인덱스가 있는 경우
CREATE INDEX idx_chunk_tenant ON "AiKnowledgeChunk" ("tenantId");

-- RLS 정책 적용 후 EXPLAIN ANALYZE:
-- Index Scan using idx_chunk_tenant on AiKnowledgeChunk
--   Index Cond: (tenantId = current_setting('app.current_tenant_id'))
-- → 인덱스 활용 O (빠름)

-- ❌ tenantId 인덱스 없는 경우:
-- Seq Scan on AiKnowledgeChunk
--   Filter: (tenantId = current_setting('app.current_tenant_id'))
-- → 전수 검색 (느림)
```

### 10.4 RLS와 SECURITY DEFINER 함수

RLS 정책에서 복잡한 로직이 필요하면 함수를 사용합니다.

```sql
-- 테넌트 격리 검증 함수 (SECURITY DEFINER로 권한 우회 방지)
CREATE OR REPLACE FUNCTION is_tenant_accessible(p_tenant_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER  -- 호출자 권한으로 실행 (DEFINER는 보안 위험)
STABLE            -- 같은 입력 = 같은 출력 (최적화 힌트)
AS $$
BEGIN
  RETURN p_tenant_id = current_setting('app.current_tenant_id', true);
END;
$$;

-- 함수를 활용한 RLS 정책
CREATE POLICY tenant_isolation_v2 ON "AiKnowledgeChunk"
  USING (is_tenant_accessible("tenantId"::text));
```

---

## 11. 성능 병목 진단 플로우차트

데이터베이스 성능 문제가 발생했을 때 체계적으로 원인을 찾는 방법입니다.

```mermaid
flowchart TD
    START([성능 문제 발생\n응답 지연 / 타임아웃]) --> CHECK_CONN

    CHECK_CONN{연결 수 확인\npg_stat_activity}
    CHECK_CONN -->|연결 수 > max_connections * 0.8| CONN_ISSUE
    CHECK_CONN -->|연결 수 정상| CHECK_QUERY

    CONN_ISSUE[연결 포화 문제]
    CONN_ISSUE --> CONN_FIX["PgBouncer 설정 확인\nmax_client_conn 증가\nconnection leak 탐지"]

    CHECK_QUERY{슬로우 쿼리 확인\npg_stat_statements}
    CHECK_QUERY -->|mean_exec_time > 100ms| SLOW_QUERY
    CHECK_QUERY -->|쿼리 정상| CHECK_LOCK

    SLOW_QUERY[느린 쿼리 발견]
    SLOW_QUERY --> EXPLAIN["EXPLAIN ANALYZE 실행\n실행 계획 분석"]
    EXPLAIN --> SCAN_TYPE{Seq Scan 발생?}
    SCAN_TYPE -->|Yes, 대용량 테이블| ADD_INDEX["인덱스 추가\n복합/부분/커버링 검토"]
    SCAN_TYPE -->|Yes, 소용량 테이블| STATS_UPDATE["ANALYZE 실행\n통계 업데이트"]
    SCAN_TYPE -->|No, Index Scan| OPTIMIZE_QUERY["쿼리 로직 개선\nN+1 문제 확인\nBatch 처리 전환"]

    CHECK_LOCK{잠금 대기 확인\npg_stat_activity\nwait_event=Lock}
    CHECK_LOCK -->|잠금 대기 발생| LOCK_ISSUE
    CHECK_LOCK -->|잠금 없음| CHECK_BLOAT

    LOCK_ISSUE[잠금 경합 문제]
    LOCK_ISSUE --> LOCK_FIX["잠금 보유 쿼리 식별\n트랜잭션 범위 축소\n인덱스 잠금 레벨 검토\nSELECT FOR UPDATE NOWAIT 검토"]

    CHECK_BLOAT{테이블 bloat 확인\npg_stat_user_tables}
    CHECK_BLOAT -->|dead_pct > 20%| BLOAT_ISSUE
    CHECK_BLOAT -->|bloat 정상| CHECK_RESOURCE

    BLOAT_ISSUE[Bloat 문제]
    BLOAT_ISSUE --> BLOAT_FIX["VACUUM ANALYZE 실행\nautovacuum 파라미터 조정\n테이블 파티셔닝 검토"]

    CHECK_RESOURCE{시스템 자원 확인\nCPU / 메모리 / 디스크 IO}
    CHECK_RESOURCE -->|CPU > 80%| CPU_ISSUE["병렬 쿼리 설정 검토\nmax_parallel_workers 조정\n쿼리 최적화"]
    CHECK_RESOURCE -->|메모리 부족| MEM_ISSUE["shared_buffers 증가\nwork_mem 조정\n커넥션 수 줄임"]
    CHECK_RESOURCE -->|디스크 IO 높음| IO_ISSUE["인덱스 효율성 검토\ncheckpoint_completion_target 조정\nIO 스케줄러 설정"]
    CHECK_RESOURCE -->|자원 정상| CHECK_CNPG

    CHECK_CNPG{CNPG 클러스터 상태\nkubectl get cluster}
    CHECK_CNPG -->|Replica 지연 발생| REPLICATION["복제 지연 원인 분석\nmax_wal_senders 확인\n네트워크 대역폭 확인"]
    CHECK_CNPG -->|Primary 전환 중| FAILOVER["자동 전환 진행 중\nPgBouncer 재연결 대기\n완료 후 상태 재확인"]
    CHECK_CNPG -->|클러스터 정상| RESOLVED

    RESOLVED([문제 해결 완료\n모니터링 대시보드 확인])

    ADD_INDEX --> RESOLVED
    STATS_UPDATE --> RESOLVED
    OPTIMIZE_QUERY --> RESOLVED
    CONN_FIX --> RESOLVED
    LOCK_FIX --> RESOLVED
    BLOAT_FIX --> RESOLVED

    classDef problem fill:#FFCDD2,stroke:#C62828
    classDef solution fill:#C8E6C9,stroke:#2E7D32
    classDef check fill:#E3F2FD,stroke:#1565C0
    classDef resolved fill:#F3E5F5,stroke:#6A1B9A

    class CONN_ISSUE,SLOW_QUERY,LOCK_ISSUE,BLOAT_ISSUE problem
    class CONN_FIX,ADD_INDEX,STATS_UPDATE,OPTIMIZE_QUERY,LOCK_FIX,BLOAT_FIX solution
    class CHECK_CONN,CHECK_QUERY,CHECK_LOCK,CHECK_BLOAT,CHECK_RESOURCE,CHECK_CNPG,SCAN_TYPE check
    class RESOLVED resolved
```

### 11.1 진단 쿼리 모음

```sql
-- 현재 연결 요약
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;

-- Top 5 느린 쿼리 (pg_stat_statements)
SELECT LEFT(query, 80), calls, ROUND(mean_exec_time) AS avg_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 5;

-- 잠금 대기 쿼리
SELECT pid, LEFT(query, 60), wait_event, state
FROM pg_stat_activity WHERE wait_event_type = 'Lock';

-- Bloat 높은 테이블
SELECT relname, n_dead_tup, n_live_tup,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 1) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_pct DESC;

-- 인덱스 미사용 (전수 검색만 하는 테이블)
SELECT relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100 AND idx_scan < seq_scan * 0.1;

-- 복제 지연 (CNPG Replica)
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  pg_wal_lsn_diff(sent_lsn, write_lsn) AS write_lag_bytes,
  reply_time
FROM pg_stat_replication;
```

### 11.2 운영 점검 체크리스트 (CSAP D-07 가용성 관리)

매일, 매주, 매월 점검해야 할 항목입니다.

```
[매일 점검]
□ 슬로우 쿼리 로그 확인 (log_min_duration_statement > 1초)
□ AutoVacuum 실행 현황 (pg_stat_user_tables.last_autovacuum)
□ 복제 지연 (pg_stat_replication.write_lag_bytes < 1MB)
□ 연결 수 (pg_stat_activity.count < max_connections * 0.8)

[매주 점검]
□ Bloat 높은 테이블 (dead_pct > 20%)
□ 미사용 인덱스 (idx_scan = 0, 생성 후 1주일 이상)
□ pg_stat_statements Top 10 쿼리 최적화 검토
□ 백업 성공 여부 (kubectl get backups)

[매월 점검]
□ VACUUM FULL 대상 테이블 선정 (서비스 중단 필요)
□ 파티션 관리 (다음 달 파티션 생성, 1년 이상 된 파티션 삭제)
□ PostgreSQL 버전 업데이트 검토
□ CNPG 오퍼레이터 업데이트 검토
```

---

## 요약 및 다음 단계

이 가이드에서 학습한 내용을 정리합니다.

| 주제 | 핵심 내용 |
|------|----------|
| 벡터 저장 | JSON 컬럼 + TypeScript 코사인 유사도 → 향후 pgvector HNSW로 전환 |
| 테넌트 격리 | `tenantId` 필터 + RLS 이중 격리 |
| 실행 계획 | EXPLAIN ANALYZE로 Seq Scan 발견 → 인덱스 추가 |
| VACUUM | 테이블 유형별 다른 autovacuum 설정, 감사 로그는 파티셔닝 |
| 연결 풀링 | pgBouncer Transaction 모드 + CNPG Pooler 리소스 |
| 인덱스 | 복합/부분/커버링 인덱스 적재적소 사용 |
| 진단 | 연결→슬로우쿼리→잠금→Bloat→자원 순서로 확인 |

**다음 학습 권장 가이드**:
- `02-architecture/21-multi-tenant-architecture.md` — 멀티테넌트 아키텍처 완전 가이드
- `03-development/13-prisma-advanced.md` — Prisma 고급 활용
- `03-development/15-redis-patterns.md` — Redis 캐싱으로 DB 부하 감소

---

*Design Ref: SVC-AI-2026 DESIGN §1, SVC-AI-ADV-R1 DESIGN §6*
*Plan SC: FR-AI26.1, FR-ADV1.7*
*CSAP: D-06 감사 로깅, D-07 가용성 관리, D-09 암호화*
