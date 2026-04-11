// RAG 엔진 — FR-AI26.1, FR-ADV1.7
// Design Ref: SVC-AI-2026 DESIGN §1, SVC-AI-ADV-R1 DESIGN §6
// 하이브리드 검색(시맨틱+키워드) + LLM 생성 + 출처 인용
// Advanced RAG: 하이브리드 검색(BM25+시맨틱 RRF) + Reranking + 쿼리 확장 + 컨텍스트 압축

import { getLLMConfig, buildLLMConfig, createLLMProvider } from './llm-provider.js';
import { semanticSearch } from './vector-store.js';
import { hybridSearch } from './hybrid-retriever.js';
import { rerankResults } from './reranker.js';
import type { RerankResult } from './reranker.js';
import { expandQuery } from './query-expander.js';
import type { ExpandedQuery } from './query-expander.js';
import { maskPII } from './pii-masking.js';
import { prisma } from './prisma.js';
import type { LLMMessage } from './llm-provider.js';

export interface RAGSource {
  documentTitle: string;
  chunkIndex: number;
  score: number;
  excerpt: string;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  model: string;
  tokensUsed: number;
  contextChunks: number;
}

/** Advanced RAG 응답 — 기존 RAGResponse 확장 */
export interface AdvancedRAGResponse extends RAGResponse {
  /** 사용된 검색 모드 */
  searchMode: 'semantic' | 'keyword' | 'hybrid';
  /** 쿼리 확장 결과 (활성화 시) */
  queryExpansion?: ExpandedQuery;
  /** Reranking 적용 여부 */
  rerankingApplied: boolean;
  /** 상세 검색 통계 */
  retrievalStats: {
    bm25Candidates: number;
    semanticCandidates: number;
    fusedCandidates: number;
    rerankCandidates: number;
    finalCount: number;
  };
}

export interface RAGOptions {
  topK?: number;
  minScore?: number;
  maxContextTokens?: number;
  systemPrompt?: string;
}

/** Advanced RAG 옵션 — 기존 RAGOptions 확장 */
export interface AdvancedRAGOptions extends RAGOptions {
  /** 검색 모드 (기본: 'hybrid') */
  searchMode?: 'semantic' | 'keyword' | 'hybrid';
  /** Reranking 활성화 (기본: true) */
  enableReranking?: boolean;
  /** 쿼리 확장 활성화 (기본: false) */
  enableQueryExpansion?: boolean;
  /** 컨텍스트 압축 활성화 (기본: false) */
  enableCompression?: boolean;
  /** BM25 가중치 (기본: 0.4) */
  bm25Weight?: number;
}

const DEFAULT_SYSTEM_PROMPT = `당신은 공공기관 문서 전문 AI 어시스턴트입니다.
반드시 제공된 문서 컨텍스트에 근거하여 답변하세요.
문서에 없는 내용은 "제공된 문서에서 찾을 수 없습니다"라고 정직하게 답하세요.
답변은 한국어로, 공공기관 공문서 스타일로 작성하세요.
각 주장에는 [출처: 문서명] 형식으로 근거를 명시하세요.`;

/**
 * RAG 파이프라인: 검색 → 컨텍스트 구성 → LLM 생성
 */
export async function runRAG(
  tenantId: string,
  question: string,
  queryEmbedding: number[],
  options: RAGOptions = {},
  modelConfig?: { provider: string; endpoint: string; name: string; config?: unknown },
): Promise<RAGResponse> {
  const { topK = 5, minScore = 0.25, maxContextTokens = 6000, systemPrompt } = options;

  // 1. 시맨틱 검색
  const searchResults = await semanticSearch(queryEmbedding, tenantId, topK, minScore);

  let contextText = '';
  let totalContextTokens = 0;
  const sources: RAGSource[] = [];

  // 2. 컨텍스트 구성 (토큰 예산 내에서)
  for (const result of searchResults) {
    const chunkTokens = result.chunk.tokenCount;
    if (totalContextTokens + chunkTokens > maxContextTokens) break;

    const docTitle = String(result.chunk.metadata['documentTitle'] ?? '문서');
    contextText += `\n[문서: ${docTitle}, 청크 ${result.chunk.chunkIndex + 1}]\n${result.chunk.content}\n`;
    totalContextTokens += chunkTokens;

    sources.push({
      documentTitle: docTitle,
      chunkIndex: result.chunk.chunkIndex,
      score: result.score,
      excerpt: result.chunk.content.slice(0, 150) + (result.chunk.content.length > 150 ? '...' : ''),
    });
  }

  // 검색 결과가 없는 경우
  if (contextText.length === 0) {
    return {
      answer: '죄송합니다. 해당 질문에 관련된 문서를 찾을 수 없습니다. 더 구체적인 질문을 해주세요.',
      sources: [],
      model: 'rag-no-context',
      tokensUsed: 0,
      contextChunks: 0,
    };
  }

  // 3. LLM 생성
  const maskedQuestion = maskPII(question);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `다음 문서들을 참고하여 질문에 답변해주세요.

=== 참고 문서 ===
${contextText}

=== 질문 ===
${maskedQuestion}`,
    },
  ];

  const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();
  const provider = await createLLMProvider(llmConfig);
  const llmResponse = await provider.chat(messages, { maxTokens: 2048 });

  return {
    answer: maskPII(llmResponse.text),
    sources,
    model: llmResponse.model,
    tokensUsed: llmResponse.tokensUsed,
    contextChunks: searchResults.length,
  };
}

// ── Advanced RAG 파이프라인 ──────────────────────────────────────────────────
// Design Ref: SVC-AI-ADV-R1 DESIGN §6
// Plan SC: FR-ADV1.7

/**
 * Advanced RAG 파이프라인: 하이브리드 검색 + Reranking + 쿼리 확장 + 컨텍스트 압축
 * Plan SC: FR-ADV1.7
 *
 * 기존 runRAG의 상위 호환으로, searchMode='semantic'이면 기존 동작과 동일합니다.
 *
 * 파이프라인 흐름:
 * 1. (선택) 쿼리 확장: LLM이 질문을 다양한 관점으로 재작성
 * 2. 하이브리드 검색: BM25 + 시맨틱 → RRF 융합
 * 3. (선택) Reranking: LLM이 후보 문서의 관련도를 정밀 재평가
 * 4. (선택) 컨텍스트 압축: 관련 구절만 추출하여 토큰 절약
 * 5. LLM 답변 생성 + 출처 인용
 */
export async function runAdvancedRAG(
  tenantId: string,
  question: string,
  queryEmbedding: number[],
  options: AdvancedRAGOptions = {},
  modelConfig?: { provider: string; endpoint: string; name: string; config?: unknown },
): Promise<AdvancedRAGResponse> {
  const {
    topK = 5,
    minScore = 0.25,
    maxContextTokens = 6000,
    systemPrompt,
    searchMode = 'hybrid',
    enableReranking = true,
    enableQueryExpansion = false,
    enableCompression = false,
    bm25Weight = 0.4,
  } = options;

  // 검색 통계 초기화
  const retrievalStats = {
    bm25Candidates: 0,
    semanticCandidates: 0,
    fusedCandidates: 0,
    rerankCandidates: 0,
    finalCount: 0,
  };

  // 1. 쿼리 확장 (선택)
  let queryExpansion: ExpandedQuery | undefined;
  let effectiveQueries = [question];

  if (enableQueryExpansion) {
    queryExpansion = await expandQuery(question);
    effectiveQueries = queryExpansion.variants;
  }

  // 2. 검색 실행 (모드에 따라 분기)
  let sources: RAGSource[] = [];
  let contextText = '';
  let totalContextTokens = 0;

  if (searchMode === 'hybrid' || searchMode === 'keyword') {
    // 하이브리드/키워드 검색 경로
    const rerankTopK = enableReranking ? 20 : topK;
    const { results: hybridResults, stats } = await hybridSearch(
      effectiveQueries[0] ?? question,
      queryEmbedding,
      tenantId,
      {
        topK: rerankTopK,
        bm25Weight: searchMode === 'keyword' ? 0.9 : bm25Weight,
        semanticWeight: searchMode === 'keyword' ? 0.1 : (1 - bm25Weight),
        minSemanticScore: minScore,
      },
    );

    retrievalStats.bm25Candidates = stats.bm25Candidates;
    retrievalStats.semanticCandidates = stats.semanticCandidates;
    retrievalStats.fusedCandidates = stats.fusedCandidates;

    // 3. Reranking (선택)
    if (enableReranking && hybridResults.length > 0) {
      const reranked: RerankResult[] = await rerankResults(
        question,
        hybridResults,
        {
          candidateCount: Math.min(20, hybridResults.length),
          returnCount: topK,
          minRelevance: 3,
          enableCompression,
        },
      );

      retrievalStats.rerankCandidates = reranked.length;

      // Reranked 결과에서 컨텍스트 구성
      for (const result of reranked) {
        const content = result.compressedContent ?? result.chunk.content;
        const chunkTokens = Math.ceil(content.length / 2);
        if (totalContextTokens + chunkTokens > maxContextTokens) break;

        const docTitle = String(result.chunk.metadata['documentTitle'] ?? '문서');
        contextText += `\n[문서: ${docTitle}, 청크 ${result.chunk.chunkIndex + 1}, 관련도: ${result.relevanceScore}/10]\n${content}\n`;
        totalContextTokens += chunkTokens;

        sources.push({
          documentTitle: docTitle,
          chunkIndex: result.chunk.chunkIndex,
          score: result.relevanceScore / 10, // 0~1 정규화
          excerpt: content.slice(0, 150) + (content.length > 150 ? '...' : ''),
        });
      }
    } else {
      // Reranking 미적용: 하이브리드 결과 직접 사용
      for (const result of hybridResults.slice(0, topK)) {
        const chunkTokens = result.chunk.tokenCount;
        if (totalContextTokens + chunkTokens > maxContextTokens) break;

        const docTitle = String(result.chunk.metadata['documentTitle'] ?? '문서');
        contextText += `\n[문서: ${docTitle}, 청크 ${result.chunk.chunkIndex + 1}]\n${result.chunk.content}\n`;
        totalContextTokens += chunkTokens;

        sources.push({
          documentTitle: docTitle,
          chunkIndex: result.chunk.chunkIndex,
          score: result.rrfScore,
          excerpt: result.chunk.content.slice(0, 150) + (result.chunk.content.length > 150 ? '...' : ''),
        });
      }
    }
  } else {
    // 순수 시맨틱 검색 경로 (기존 동작과 동일)
    const searchResults = await semanticSearch(queryEmbedding, tenantId, topK, minScore);
    retrievalStats.semanticCandidates = searchResults.length;

    for (const result of searchResults) {
      const chunkTokens = result.chunk.tokenCount;
      if (totalContextTokens + chunkTokens > maxContextTokens) break;

      const docTitle = String(result.chunk.metadata['documentTitle'] ?? '문서');
      contextText += `\n[문서: ${docTitle}, 청크 ${result.chunk.chunkIndex + 1}]\n${result.chunk.content}\n`;
      totalContextTokens += chunkTokens;

      sources.push({
        documentTitle: docTitle,
        chunkIndex: result.chunk.chunkIndex,
        score: result.score,
        excerpt: result.chunk.content.slice(0, 150) + (result.chunk.content.length > 150 ? '...' : ''),
      });
    }
  }

  retrievalStats.finalCount = sources.length;

  // 검색 결과가 없는 경우
  if (contextText.length === 0) {
    return {
      answer: '죄송합니다. 해당 질문에 관련된 문서를 찾을 수 없습니다. 더 구체적인 질문을 해주세요.',
      sources: [],
      model: 'rag-no-context',
      tokensUsed: 0,
      contextChunks: 0,
      searchMode,
      queryExpansion,
      rerankingApplied: enableReranking,
      retrievalStats,
    };
  }

  // 4. LLM 답변 생성
  const maskedQuestion = maskPII(question);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `다음 문서들을 참고하여 질문에 답변해주세요.

=== 참고 문서 ===
${contextText}

=== 질문 ===
${maskedQuestion}`,
    },
  ];

  const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();
  const provider = await createLLMProvider(llmConfig);
  const llmResponse = await provider.chat(messages, { maxTokens: 2048 });

  return {
    answer: maskPII(llmResponse.text),
    sources,
    model: llmResponse.model,
    tokensUsed: llmResponse.tokensUsed,
    contextChunks: sources.length,
    searchMode,
    queryExpansion,
    rerankingApplied: enableReranking,
    retrievalStats,
  };
}

/**
 * RAG용 임베딩 생성 (질문 또는 문서 청크)
 */
export async function generateEmbedding(
  text: string,
  embedModelId?: string,
): Promise<number[]> {
  // 임베딩 모델 조회: DB에서 embed 타입 모델 우선
  let embedConfig = getLLMConfig();

  if (embedModelId) {
    const model = await prisma.aiModel.findUnique({ where: { id: embedModelId } });
    if (model?.isActive) {
      embedConfig = buildLLMConfig({ provider: model.provider, endpoint: model.endpoint, name: model.name, config: model.config });
    }
  } else {
    // DB에서 임베딩 모델 자동 선택 (name에 embed 포함)
    const embedModel = await prisma.aiModel.findFirst({
      where: { isActive: true, name: { contains: 'embed' } },
    });
    if (embedModel) {
      embedConfig = buildLLMConfig({ provider: embedModel.provider, endpoint: embedModel.endpoint, name: embedModel.name, config: embedModel.config });
    }
  }

  const provider = await createLLMProvider(embedConfig);
  const result = await provider.embed([maskPII(text)]);
  return result.embeddings[0] ?? [];
}
