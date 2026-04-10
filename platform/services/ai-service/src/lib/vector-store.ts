// 벡터 저장소 — FR-AI26.1 RAG 엔진
// Design Ref: SVC-AI-2026 DESIGN §1
// PostgreSQL JSON 컬럼 기반 벡터 저장 + 코사인 유사도 검색
// (pgvector 없이도 작동하는 순수 TypeScript 구현)
// NOTE: 미사용. SVC-AI-2026 Phase 구현 시 활성화 예정.
//       Prisma 스키마에 AiKnowledgeDocument / AiKnowledgeChunk 추가 필요.

import { prisma } from './prisma.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma 모델 미생성 상태, SVC-AI-2026 스키마 추가 시 제거
const db = prisma as Record<string, any>;

export interface VectorDocument {
  id: string;
  tenantId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  tokenCount: number;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  chunk: VectorDocument;
  score: number; // 코사인 유사도 0~1
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
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 청크를 벡터 저장소에 저장
 * AiKnowledgeChunk 모델 활용 (JSON 컬럼에 임베딩 저장)
 */
export async function storeChunks(
  tenantId: string,
  documentId: string,
  chunks: Array<{ content: string; chunkIndex: number; tokenCount: number; embedding: number[] }>,
): Promise<void> {
  const data = chunks.map((c) => ({
    tenantId,
    documentId,
    chunkIndex: c.chunkIndex,
    content: c.content,
    embeddingJson: JSON.stringify(c.embedding),
    tokenCount: c.tokenCount,
  }));

  // 기존 청크 삭제 후 재저장 (upsert 효과)
  await db['aiKnowledgeChunk'].deleteMany({ where: { documentId } });
  await db['aiKnowledgeChunk'].createMany({ data });
}

/**
 * 의미 검색: 쿼리 임베딩과 저장된 청크를 비교하여 유사한 청크 반환
 * @param queryEmbedding 쿼리 임베딩 벡터
 * @param tenantId 테넌트 ID (격리)
 * @param topK 반환할 청크 수 (기본 5)
 * @param minScore 최소 유사도 임계값 (기본 0.3)
 */
export async function semanticSearch(
  queryEmbedding: number[],
  tenantId: string,
  topK = 5,
  minScore = 0.3,
): Promise<SearchResult[]> {
  // 테넌트 격리된 청크 전체 로드 (소규모 데이터셋 최적화)
  // 대규모 데이터셋: pgvector로 마이그레이션 권장
  const chunks = await db['aiKnowledgeChunk'].findMany({
    where: { tenantId, document: { isActive: true } },
    include: { document: { select: { title: true, sourceUrl: true } } },
    take: 10000, // 최대 10k 청크 (메모리 보호)
  });

  const mapped = (chunks as Array<Record<string, any>>)
    .map((chunk: Record<string, any>): SearchResult | null => {
      let embedding: number[] = [];
      try {
        embedding = JSON.parse(chunk['embeddingJson'] as string) as number[];
      } catch {
        return null;
      }
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (score < minScore) return null;
      return {
        chunk: {
          id: chunk['id'] as string,
          tenantId: chunk['tenantId'] as string,
          documentId: chunk['documentId'] as string,
          chunkIndex: chunk['chunkIndex'] as number,
          content: chunk['content'] as string,
          embedding,
          tokenCount: chunk['tokenCount'] as number,
          metadata: {
            documentTitle: (chunk['document'] as Record<string, unknown>)?.['title'] ?? '',
            sourceUrl: (chunk['document'] as Record<string, unknown>)?.['sourceUrl'] ?? '',
          },
        },
        score,
      };
    });

  const results: SearchResult[] = mapped
    .filter((r): r is SearchResult => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return results;
}

/**
 * 테넌트의 지식베이스 통계
 */
export async function getKnowledgeStats(tenantId: string): Promise<{
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
}> {
  const [docCount, chunkAgg] = await Promise.all([
    db['aiKnowledgeDocument'].count({ where: { tenantId, isActive: true } }),
    db['aiKnowledgeChunk'].aggregate({
      where: { tenantId },
      _count: true,
      _sum: { tokenCount: true },
    }),
  ]);

  return {
    documentCount: docCount as number,
    chunkCount: (chunkAgg as Record<string, any>)['_count'] as number,
    totalTokens: ((chunkAgg as Record<string, any>)['_sum'] as Record<string, number>)?.['tokenCount'] ?? 0,
  };
}
