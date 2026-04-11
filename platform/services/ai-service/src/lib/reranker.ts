// Cross-encoder Reranker + 컨텍스트 압축 — FR-ADV1.3, FR-ADV1.5
// Design Ref: SVC-AI-ADV-R1 DESIGN §2, §4
// LLM을 Cross-encoder로 활용하여 검색 결과 재정렬 + 관련 구절 추출
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급 데이터만 처리

import { getLLMConfig, buildLLMConfig, createLLMProvider } from './llm-provider.js';
import { maskPII } from './pii-masking.js';
import type { LLMMessage } from './llm-provider.js';
import type { VectorDocument } from './vector-store.js';
import type { HybridSearchResult } from './hybrid-retriever.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface RerankOptions {
  /** Reranking 후보 수 (기본 20) */
  candidateCount?: number;
  /** 최종 반환 수 (기본 5) */
  returnCount?: number;
  /** 최소 관련도 점수 0~10 (기본 3) */
  minRelevance?: number;
  /** 컨텍스트 압축 활성화 (기본 false) */
  enableCompression?: boolean;
  /** LLM 모델 설정 (기본: 환경 변수) */
  modelConfig?: { provider: string; endpoint: string; name: string; config?: unknown };
}

export interface RerankResult {
  chunk: VectorDocument;
  /** LLM이 평가한 관련도 점수 (0~10) */
  relevanceScore: number;
  /** LLM 판단 근거 */
  explanation: string;
  /** 원본 검색 순위 */
  originalRank: number;
  /** 압축된 컨텍스트 (enableCompression=true 시) */
  compressedContent?: string;
}

// ── Reranking 프롬프트 ─────────────────────────────────────────────────────

const RERANK_SYSTEM_PROMPT = `당신은 공공기관 문서 검색 관련도 평가 전문가입니다.
사용자 질문과 문서 청크의 관련도를 0~10 점수로 정밀하게 평가합니다.

평가 기준:
- 10: 질문에 직접적이고 완전한 답변을 포함
- 7~9: 질문과 높은 관련성, 부분적 답변 포함
- 4~6: 간접적 관련성, 배경 정보 제공
- 1~3: 낮은 관련성, 주제만 유사
- 0: 전혀 무관

반드시 아래 JSON 형식으로만 응답하세요:
[
  {"index": 0, "score": 8, "reason": "평가 근거 1줄"}
]`;

function buildRerankPrompt(query: string, chunks: Array<{ index: number; content: string }>): string {
  const maskedQuery = maskPII(query);
  const chunkTexts = chunks
    .map((c) => `[문서 ${c.index}]\n${maskPII(c.content.slice(0, 500))}`)
    .join('\n\n---\n\n');

  return `## 질문
${maskedQuery}

## 후보 문서
${chunkTexts}

위 문서들의 관련도를 평가하여 JSON 배열로 응답하세요.`;
}

// ── 컨텍스트 압축 프롬프트 ─────────────────────────────────────────────────

const COMPRESSION_SYSTEM_PROMPT = `당신은 문서 압축 전문가입니다.
주어진 문서 청크에서 질문에 답변하는 데 필요한 핵심 문장만 추출합니다.
불필요한 배경 설명, 반복, 상투적 표현은 제거합니다.
원문의 핵심 내용만 남기되, 의미가 변경되지 않도록 주의합니다.
추출된 내용만 출력하세요. 다른 설명은 포함하지 마세요.`;

// ── LLM 응답 파싱 ──────────────────────────────────────────────────────────

interface RerankScore {
  index: number;
  score: number;
  reason: string;
}

function parseRerankResponse(text: string): RerankScore[] {
  // JSON 배열 추출
  const jsonMatch = /\[[\s\S]*\]/.exec(text);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
    return parsed
      .filter((item) => typeof item['index'] === 'number' && typeof item['score'] === 'number')
      .map((item) => ({
        index: item['index'] as number,
        score: Math.max(0, Math.min(10, item['score'] as number)),
        reason: String(item['reason'] ?? ''),
      }));
  } catch {
    return [];
  }
}

// ── Reranking 메인 함수 ────────────────────────────────────────────────────

/**
 * LLM 기반 Cross-encoder Reranking
 * Plan SC: FR-ADV1.3
 *
 * 하이브리드 검색 결과를 LLM이 질문-문서 쌍별로 관련도를 재평가하여
 * 가장 관련성 높은 문서를 상위로 재정렬합니다.
 *
 * @param query 사용자 질문
 * @param candidates 하이브리드 검색 결과
 * @param options Reranking 옵션
 */
export async function rerankResults(
  query: string,
  candidates: HybridSearchResult[],
  options: RerankOptions = {},
): Promise<RerankResult[]> {
  const {
    candidateCount = 20,
    returnCount = 5,
    minRelevance = 3,
    enableCompression = false,
    modelConfig,
  } = options;

  // 후보 수 제한
  const topCandidates = candidates.slice(0, candidateCount);

  if (topCandidates.length === 0) return [];

  // 배치 크기: LLM 컨텍스트 제한 고려 (10개씩 배치)
  const BATCH_SIZE = 10;
  const allScores: RerankScore[] = [];

  const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();
  const provider = await createLLMProvider(llmConfig);

  for (let batchStart = 0; batchStart < topCandidates.length; batchStart += BATCH_SIZE) {
    const batch = topCandidates.slice(batchStart, batchStart + BATCH_SIZE);
    const chunkInputs = batch.map((c, localIdx) => ({
      index: batchStart + localIdx,
      content: c.chunk.content,
    }));

    const messages: LLMMessage[] = [
      { role: 'system', content: RERANK_SYSTEM_PROMPT },
      { role: 'user', content: buildRerankPrompt(query, chunkInputs) },
    ];

    try {
      const response = await provider.chat(messages, { maxTokens: 1024, temperature: 0.1 });
      const batchScores = parseRerankResponse(response.text);
      allScores.push(...batchScores);
    } catch (err) {
      // LLM 호출 실패 시 원본 순위 유지 (graceful degradation)
      for (let i = 0; i < batch.length; i++) {
        allScores.push({
          index: batchStart + i,
          score: Math.max(0, 10 - (batchStart + i)), // 원본 순위 기반 점수
          reason: 'Reranking LLM 호출 실패 — 원본 순위 유지',
        });
      }
    }
  }

  // 점수 매핑 + 필터링
  const scoreMap = new Map<number, RerankScore>();
  for (const score of allScores) {
    scoreMap.set(score.index, score);
  }

  let reranked: RerankResult[] = topCandidates
    .map((candidate, idx) => {
      const score = scoreMap.get(idx);
      return {
        chunk: candidate.chunk,
        relevanceScore: score?.score ?? 0,
        explanation: score?.reason ?? '',
        originalRank: candidate.rank,
      };
    })
    .filter((r) => r.relevanceScore >= minRelevance)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, returnCount);

  // 컨텍스트 압축 (선택적)
  if (enableCompression && reranked.length > 0) {
    reranked = await compressContexts(query, reranked, provider);
  }

  return reranked;
}

// ── 컨텍스트 압축 ──────────────────────────────────────────────────────────

/**
 * 컨텍스트 압축: 검색된 청크에서 질문 관련 핵심 구절만 추출
 * Plan SC: FR-ADV1.5
 */
async function compressContexts(
  query: string,
  results: RerankResult[],
  provider: Awaited<ReturnType<typeof createLLMProvider>>,
): Promise<RerankResult[]> {
  const maskedQuery = maskPII(query);

  const compressed = await Promise.all(
    results.map(async (result) => {
      const maskedContent = maskPII(result.chunk.content);

      const messages: LLMMessage[] = [
        { role: 'system', content: COMPRESSION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `## 질문\n${maskedQuery}\n\n## 문서\n${maskedContent}`,
        },
      ];

      try {
        const response = await provider.chat(messages, { maxTokens: 512, temperature: 0.1 });
        return {
          ...result,
          compressedContent: response.text.trim(),
        };
      } catch {
        // 압축 실패 시 원본 유지
        return result;
      }
    }),
  );

  return compressed;
}

/**
 * 간편 Reranking (하이브리드 검색 없이 직접 사용)
 * 외부에서 VectorDocument 배열을 넘겨 rerank할 때 사용
 */
export async function rerankDocuments(
  query: string,
  documents: VectorDocument[],
  options: RerankOptions = {},
): Promise<RerankResult[]> {
  const candidates: HybridSearchResult[] = documents.map((chunk, idx) => ({
    chunk,
    bm25Score: 0,
    semanticScore: 0,
    rrfScore: 0,
    rank: idx + 1,
  }));

  return rerankResults(query, candidates, options);
}
