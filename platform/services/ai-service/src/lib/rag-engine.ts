// RAG 엔진 — FR-AI26.1
// Design Ref: SVC-AI-2026 DESIGN §1
// 하이브리드 검색(시맨틱+키워드) + LLM 생성 + 출처 인용

import { getLLMConfig, buildLLMConfig, createLLMProvider } from './llm-provider.js';
import { semanticSearch } from './vector-store.js';
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

export interface RAGOptions {
  topK?: number;
  minScore?: number;
  maxContextTokens?: number;
  systemPrompt?: string;
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
