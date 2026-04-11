// 하이브리드 검색기 — FR-ADV1.1, FR-ADV1.2
// Design Ref: SVC-AI-ADV-R1 DESIGN §1
// BM25 키워드 검색 + 시맨틱 벡터 검색 → Reciprocal Rank Fusion (RRF)
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급 데이터만 처리

import { semanticSearch } from './vector-store.js';
import type { VectorDocument, SearchResult } from './vector-store.js';
import { prisma } from './prisma.js';

// NOTE: Record<string, unknown> 미사용 — Prisma 모델(AiKnowledgeDocument/Chunk) 미생성 상태.
//       SVC-AI-2026 스키마 추가 시 타입 안전한 Prisma Client로 교체 예정. 2026-07-01 재검토.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma 모델 미생성 상태
const db = prisma as Record<string, any>;

// ── BM25 설정 ──────────────────────────────────────────────────────────────

/** BM25 파라미터 (표준값) */
const BM25_K1 = 1.2;
const BM25_B = 0.75;

/** RRF 상수 (업계 표준 k=60) */
const RRF_K = 60;

/** 한국어 불용어 사전 */
const KOREAN_STOPWORDS = new Set([
  '이', '그', '저', '것', '수', '등', '및', '또는', '또한', '그리고',
  '하지만', '그러나', '때문에', '위해', '대해', '통해', '따라',
  '에서', '으로', '에게', '부터', '까지', '에서의', '으로의',
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과',
  '도', '만', '나', '든', '고', '며', '면', '서',
  '있다', '없다', '하다', '되다', '이다', '아니다',
  '있는', '없는', '하는', '되는', '인', '한', '된', '할',
]);

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface HybridSearchOptions {
  /** 최종 반환 수 (기본 10) */
  topK?: number;
  /** BM25 후보 수 (기본 50) */
  bm25TopK?: number;
  /** 시맨틱 후보 수 (기본 50) */
  semanticTopK?: number;
  /** BM25 가중치 (기본 0.4) */
  bm25Weight?: number;
  /** 시맨틱 가중치 (기본 0.6) */
  semanticWeight?: number;
  /** 최소 시맨틱 점수 임계값 */
  minSemanticScore?: number;
}

export interface HybridSearchResult {
  chunk: VectorDocument;
  bm25Score: number;
  semanticScore: number;
  rrfScore: number;
  rank: number;
}

export interface HybridRetrievalStats {
  bm25Candidates: number;
  semanticCandidates: number;
  fusedCandidates: number;
  finalCount: number;
}

// ── BM25 인덱스 ────────────────────────────────────────────────────────────

interface BM25Document {
  id: string;
  terms: string[];
  termFrequency: Map<string, number>;
  length: number;
}

interface BM25Index {
  documents: BM25Document[];
  documentFrequency: Map<string, number>;
  averageDocLength: number;
  totalDocuments: number;
  chunkMap: Map<string, VectorDocument>;
}

/** 테넌트별 BM25 인덱스 캐시 (LRU 방식) */
const bm25IndexCache = new Map<string, { index: BM25Index; createdAt: number }>();
const BM25_CACHE_TTL_MS = 5 * 60 * 1000; // 5분 캐시
const BM25_CACHE_MAX_SIZE = 50; // 최대 50 테넌트

// ── 한국어 토큰화 ──────────────────────────────────────────────────────────

/**
 * 한국어 텍스트 토큰화
 * Plan SC: FR-ADV1.1
 *
 * 전략: 공백 분할 → 조사 제거 → 불용어 제거 → 2-gram 생성
 */
export function tokenizeKorean(text: string): string[] {
  // 소문자 변환 + 특수문자 제거 (한글, 영문, 숫자 유지)
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');

  // 공백 분할
  const rawTokens = normalized.split(/\s+/).filter((t) => t.length > 0);

  // 한국어 조사 분리 (간이 형태소 분석)
  const tokens: string[] = [];
  const suffixPattern = /^(.{2,}?)(은|는|이|가|을|를|의|에|와|과|도|만|나|로|으로|에서|부터|까지|에게|한테|께)$/;

  for (const token of rawTokens) {
    if (KOREAN_STOPWORDS.has(token)) continue;
    if (token.length <= 1) continue;

    const suffixMatch = suffixPattern.exec(token);
    if (suffixMatch?.[1] && suffixMatch[1].length >= 2) {
      tokens.push(suffixMatch[1]);
    } else {
      tokens.push(token);
    }
  }

  // 2-gram 생성 (인접 토큰 결합)
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const t1 = tokens[i];
    const t2 = tokens[i + 1];
    if (t1 && t2) {
      bigrams.push(`${t1}_${t2}`);
    }
  }

  return [...tokens, ...bigrams];
}

// ── BM25 인덱스 구축 ──────────────────────────────────────────────────────

/**
 * 테넌트의 지식베이스에서 BM25 인덱스를 구축합니다.
 * Plan SC: FR-ADV1.1
 */
async function buildBM25Index(tenantId: string): Promise<BM25Index> {
  // 캐시 확인
  const cached = bm25IndexCache.get(tenantId);
  if (cached && Date.now() - cached.createdAt < BM25_CACHE_TTL_MS) {
    return cached.index;
  }

  // DB에서 청크 로드
  const chunks = await db['aiKnowledgeChunk'].findMany({
    where: { tenantId, document: { isActive: true } },
    include: { document: { select: { title: true, sourceUrl: true } } },
    take: 10000,
  }) as Array<Record<string, any>>;

  const documents: BM25Document[] = [];
  const documentFrequency = new Map<string, number>();
  const chunkMap = new Map<string, VectorDocument>();
  let totalLength = 0;

  for (const chunk of chunks) {
    const content = chunk['content'] as string;
    const terms = tokenizeKorean(content);
    const termFreq = new Map<string, number>();

    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
    }

    // 문서 빈도 (DF) 업데이트
    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }

    const chunkId = chunk['id'] as string;
    documents.push({
      id: chunkId,
      terms,
      termFrequency: termFreq,
      length: terms.length,
    });

    totalLength += terms.length;

    // 벡터 문서 매핑
    chunkMap.set(chunkId, {
      id: chunkId,
      tenantId: chunk['tenantId'] as string,
      documentId: chunk['documentId'] as string,
      chunkIndex: chunk['chunkIndex'] as number,
      content,
      embedding: [], // BM25에서는 임베딩 불필요
      tokenCount: chunk['tokenCount'] as number,
      metadata: {
        documentTitle: (chunk['document'] as Record<string, unknown>)?.['title'] ?? '',
        sourceUrl: (chunk['document'] as Record<string, unknown>)?.['sourceUrl'] ?? '',
      },
    });
  }

  const index: BM25Index = {
    documents,
    documentFrequency,
    averageDocLength: documents.length > 0 ? totalLength / documents.length : 0,
    totalDocuments: documents.length,
    chunkMap,
  };

  // 캐시 저장 (LRU: 최대 크기 초과 시 가장 오래된 항목 제거)
  if (bm25IndexCache.size >= BM25_CACHE_MAX_SIZE) {
    const oldestKey = bm25IndexCache.keys().next().value;
    if (oldestKey !== undefined) {
      bm25IndexCache.delete(oldestKey);
    }
  }
  bm25IndexCache.set(tenantId, { index, createdAt: Date.now() });

  return index;
}

/**
 * BM25 점수 계산
 * Plan SC: FR-ADV1.1
 *
 * score(D, Q) = sum IDF(qi) * (f(qi,D) * (k1+1)) / (f(qi,D) + k1*(1 - b + b*|D|/avgdl))
 */
function bm25Score(
  queryTerms: string[],
  doc: BM25Document,
  index: BM25Index,
): number {
  let score = 0;

  for (const term of queryTerms) {
    const df = index.documentFrequency.get(term) ?? 0;
    if (df === 0) continue;

    // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
    const idf = Math.log((index.totalDocuments - df + 0.5) / (df + 0.5) + 1);

    const tf = doc.termFrequency.get(term) ?? 0;
    if (tf === 0) continue;

    // TF 정규화
    const numerator = tf * (BM25_K1 + 1);
    const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / index.averageDocLength));

    score += idf * (numerator / denominator);
  }

  return score;
}

/**
 * BM25 키워드 검색
 * Plan SC: FR-ADV1.1
 */
async function bm25Search(
  query: string,
  tenantId: string,
  topK: number,
): Promise<Array<{ chunk: VectorDocument; score: number }>> {
  const index = await buildBM25Index(tenantId);
  if (index.totalDocuments === 0) return [];

  const queryTerms = tokenizeKorean(query);
  if (queryTerms.length === 0) return [];

  const scored = index.documents
    .map((doc) => ({
      id: doc.id,
      score: bm25Score(queryTerms, doc, index),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored
    .map((r) => {
      const chunk = index.chunkMap.get(r.id);
      if (!chunk) return null;
      return { chunk, score: r.score };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

// ── Reciprocal Rank Fusion ─────────────────────────────────────────────────

/**
 * Reciprocal Rank Fusion (RRF) 결과 융합
 * Plan SC: FR-ADV1.2
 *
 * RRF_score(d) = w1/(k + rank_bm25(d)) + w2/(k + rank_semantic(d))
 *
 * @param bm25Results BM25 검색 결과 (순위순)
 * @param semanticResults 시맨틱 검색 결과 (순위순)
 * @param bm25Weight BM25 가중치
 * @param semanticWeight 시맨틱 가중치
 */
export function reciprocalRankFusion(
  bm25Results: Array<{ chunk: VectorDocument; score: number }>,
  semanticResults: SearchResult[],
  bm25Weight = 0.4,
  semanticWeight = 0.6,
): HybridSearchResult[] {
  const fusedScores = new Map<string, {
    chunk: VectorDocument;
    bm25Score: number;
    semanticScore: number;
    rrfScore: number;
  }>();

  // BM25 결과의 RRF 점수
  for (let rank = 0; rank < bm25Results.length; rank++) {
    const result = bm25Results[rank];
    if (!result) continue;
    const { chunk } = result;
    const rrfContribution = bm25Weight / (RRF_K + rank + 1);

    const existing = fusedScores.get(chunk.id);
    if (existing) {
      existing.bm25Score = result.score;
      existing.rrfScore += rrfContribution;
    } else {
      fusedScores.set(chunk.id, {
        chunk,
        bm25Score: result.score,
        semanticScore: 0,
        rrfScore: rrfContribution,
      });
    }
  }

  // 시맨틱 결과의 RRF 점수
  for (let rank = 0; rank < semanticResults.length; rank++) {
    const result = semanticResults[rank];
    if (!result) continue;
    const { chunk, score } = result;
    const rrfContribution = semanticWeight / (RRF_K + rank + 1);

    const existing = fusedScores.get(chunk.id);
    if (existing) {
      existing.semanticScore = score;
      existing.rrfScore += rrfContribution;
    } else {
      fusedScores.set(chunk.id, {
        chunk,
        bm25Score: 0,
        semanticScore: score,
        rrfScore: rrfContribution,
      });
    }
  }

  // RRF 점수 순 정렬
  const sorted = [...fusedScores.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore);

  return sorted.map((item, index) => ({
    chunk: item.chunk,
    bm25Score: item.bm25Score,
    semanticScore: item.semanticScore,
    rrfScore: item.rrfScore,
    rank: index + 1,
  }));
}

// ── 하이브리드 검색 메인 함수 ──────────────────────────────────────────────

/**
 * 하이브리드 검색: BM25 + 시맨틱 검색 → RRF 융합
 * Plan SC: FR-ADV1.1, FR-ADV1.2
 *
 * @param query 사용자 질문
 * @param queryEmbedding 질문 임베딩 벡터
 * @param tenantId 테넌트 ID
 * @param options 검색 옵션
 */
export async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  tenantId: string,
  options: HybridSearchOptions = {},
): Promise<{ results: HybridSearchResult[]; stats: HybridRetrievalStats }> {
  const {
    topK = 10,
    bm25TopK = 50,
    semanticTopK = 50,
    bm25Weight = 0.4,
    semanticWeight = 0.6,
    minSemanticScore = 0.2,
  } = options;

  // 병렬 검색 실행
  const [bm25Results, semanticResults] = await Promise.all([
    bm25Search(query, tenantId, bm25TopK),
    semanticSearch(queryEmbedding, tenantId, semanticTopK, minSemanticScore),
  ]);

  // RRF 융합
  const fusedResults = reciprocalRankFusion(
    bm25Results,
    semanticResults,
    bm25Weight,
    semanticWeight,
  );

  const finalResults = fusedResults.slice(0, topK);

  const stats: HybridRetrievalStats = {
    bm25Candidates: bm25Results.length,
    semanticCandidates: semanticResults.length,
    fusedCandidates: fusedResults.length,
    finalCount: finalResults.length,
  };

  return { results: finalResults, stats };
}

/**
 * BM25 인덱스 캐시 무효화 (문서 변경 시 호출)
 */
export function invalidateBM25Cache(tenantId: string): void {
  bm25IndexCache.delete(tenantId);
}

/**
 * 전체 BM25 캐시 초기화
 */
export function clearBM25Cache(): void {
  bm25IndexCache.clear();
}
