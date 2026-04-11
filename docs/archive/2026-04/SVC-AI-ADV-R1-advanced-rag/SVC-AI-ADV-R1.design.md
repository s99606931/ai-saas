# SVC-AI-ADV-R1 DESIGN: Advanced RAG — 하이브리드 검색 + Reranking

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R1.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 외부 검색엔진 | Elasticsearch/Meilisearch 도입 | 성능 최적 | 외부 의존성, 인프라 복잡도 증가 |
| **B. 순수 TypeScript** | BM25 인메모리 + 기존 벡터 저장소 | 무의존, CSAP 호환, 즉시 적용 | 대규모 데이터 한계 |
| C. pgvector + pg_trgm | PostgreSQL 확장 | DB 단일화 | 확장 설치 필요 |

**선택: 옵션 B (Pragmatic Balance)** — 외부 서비스 금지 제약 준수, 기존 인프라 활용

---

## §1. 하이브리드 검색기 (hybrid-retriever.ts)

### 설계 원칙
- BM25 키워드 검색 + 시맨틱 벡터 검색 병렬 실행
- Reciprocal Rank Fusion (RRF, k=60)으로 결과 융합
- 테넌트별 BM25 인덱스 분리 (인메모리 LRU 캐시)

### BM25 구현
```
BM25 점수 공식:
score(D, Q) = Σ IDF(qi) * (f(qi, D) * (k1 + 1)) / (f(qi, D) + k1 * (1 - b + b * |D| / avgdl))

파라미터: k1=1.2, b=0.75 (표준값)
```

### 한국어 토큰화
- 공백 + 조사 분리 (간이 형태소 분석)
- 불용어 제거 (한국어 불용어 사전)
- 2-gram 인덱싱 (복합어 지원)

### RRF 융합
```
RRF_score(d) = Σ 1 / (k + rank_i(d))   (k=60)
```
- BM25 결과와 시맨틱 결과 각각의 랭킹을 RRF로 결합
- 알파 가중치: bm25Weight (기본 0.4) + semanticWeight (기본 0.6) 조절 가능

### 인터페이스
```typescript
interface HybridSearchOptions {
  topK?: number;           // 최종 반환 수 (기본 10)
  bm25TopK?: number;       // BM25 후보 수 (기본 50)
  semanticTopK?: number;   // 시맨틱 후보 수 (기본 50)
  bm25Weight?: number;     // BM25 가중치 (기본 0.4)
  semanticWeight?: number; // 시맨틱 가중치 (기본 0.6)
  minScore?: number;       // 최소 RRF 점수 임계값
}

interface HybridSearchResult {
  chunk: VectorDocument;
  bm25Score: number;
  semanticScore: number;
  rrfScore: number;
  rank: number;
}
```

---

## §2. Cross-encoder Reranker (reranker.ts)

### 설계 원칙
- LLM을 Cross-encoder로 활용 (query-document 쌍 관련도 점수화)
- 하이브리드 검색 상위 20개 → Reranking → 상위 5개 반환
- 배치 평가 (효율적 LLM 호출)

### Reranking 전략
1. 하이브리드 검색 결과 상위 N개 (기본 20) 후보 선정
2. 각 후보에 대해 LLM에게 관련도 0~10 점수 요청
3. 점수 기준 재정렬 → 상위 K개 반환

### 인터페이스
```typescript
interface RerankOptions {
  candidateCount?: number;  // 후보 수 (기본 20)
  returnCount?: number;     // 반환 수 (기본 5)
  minRelevance?: number;    // 최소 관련도 (기본 3)
}

interface RerankResult {
  chunk: VectorDocument;
  relevanceScore: number;   // 0~10
  explanation: string;      // LLM 판단 근거
  originalRank: number;
}
```

---

## §3. 쿼리 확장기 (query-expander.ts)

### 설계 원칙
- LLM으로 원본 쿼리를 2~3개 대안 쿼리로 확장
- 공공기관 맥락 반영 (법령용어, 기관명 동의어)
- 원본 쿼리 항상 포함 (환각 쿼리 방어)

### 확장 전략
1. 동의어 확장: "주민등록" → "주민등록, 주민등록증, 주민등록번호"
2. 개념 확장: "세금 환급" → "세금 환급, 국세 환급, 경정청구"
3. 맥락 확장: 질문의 의도를 다양한 관점으로 재작성

### 인터페이스
```typescript
interface QueryExpansionOptions {
  maxVariants?: number;    // 최대 변형 수 (기본 3)
  includeOriginal?: boolean; // 원본 포함 (기본 true)
}

interface ExpandedQuery {
  original: string;
  variants: string[];
  reasoning: string;
}
```

---

## §4. 컨텍스트 압축

### 설계 원칙
- 검색된 청크에서 질문과 직접 관련된 구절만 추출
- 불필요한 맥락 제거 → LLM 토큰 절약
- reranker.ts 내에 통합 구현

### 압축 방법
- LLM에게 "이 문서 청크에서 질문에 답하는 데 필요한 핵심 문장만 추출" 지시
- 원본 대비 30~50% 압축 목표

---

## §5. 부모-자식 청크 계층

### 설계 원칙
- 세분화 청크(256토큰)로 검색 → 부모 청크(1024토큰) 반환
- 검색 정밀도 + 맥락 보존 동시 달성
- chunker.ts 확장: hierarchicalChunk() 함수 추가

### 계층 구조
```
부모 청크 (1024 토큰) ← 컨텍스트 전달용
  ├── 자식 청크 1 (256 토큰) ← 검색 인덱싱용
  ├── 자식 청크 2 (256 토큰)
  └── 자식 청크 3 (256 토큰)
```

---

## §6. API 확장 (기존 /ai/rag/query 확장)

### 요청 스키마 확장
```typescript
// 기존 필드 유지 + 새 필드 추가
{
  // 기존
  tenantId: string;
  grade: 'O';
  question: string;
  topK?: number;
  minScore?: number;

  // 신규
  searchMode?: 'semantic' | 'keyword' | 'hybrid'; // 기본: 'hybrid'
  enableReranking?: boolean;    // 기본: true
  enableQueryExpansion?: boolean; // 기본: false
  enableCompression?: boolean;   // 기본: false
  bm25Weight?: number;          // 기본: 0.4
}
```

### 응답 스키마 확장
```typescript
{
  answer: string;
  sources: RAGSource[];
  // 신규
  searchMode: string;
  queryExpansion?: ExpandedQuery;
  rerankingApplied: boolean;
  retrievalStats: {
    bm25Candidates: number;
    semanticCandidates: number;
    fusedCandidates: number;
    rerankCandidates: number;
    finalCount: number;
  };
}
```

---

## Session Guide

### 구현 순서
1. `src/lib/hybrid-retriever.ts` — BM25 + RRF 하이브리드 검색기
2. `src/lib/reranker.ts` — LLM Cross-encoder Reranking + 컨텍스트 압축
3. `src/lib/query-expander.ts` — LLM 쿼리 확장
4. `src/lib/chunker.ts` — 계층적 청킹 확장
5. `src/lib/rag-engine.ts` — Advanced RAG 파이프라인 통합
6. `src/handlers/ai-rag.handler.ts` — API 확장
7. 통합 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-AI-ADV-R1 DESIGN §{섹션}`
- 모든 함수: `// Plan SC: FR-ADV1.{번호}`
