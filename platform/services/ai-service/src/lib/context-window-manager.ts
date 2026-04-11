// AI 컨텍스트 윈도우 관리자 — FR-ADV21.1~21.6
// Design Ref: SVC-AI-ADV-R21 DESIGN §1~§5
// Plan SC: SC-1 (토큰 예산), SC-2 (압축), SC-3 (우선순위), SC-4 (슬라이딩), SC-5 (오버플로우)
// CSAP: D-09 민감 컨텍스트 암호화, D-12 시스템 개발 보안
// N2SF: N-05 O등급 데이터만 컨텍스트

import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 토큰 예산 영역 — Design §1 */
export interface TokenBudget {
  /** 시스템 프롬프트 (고정) */
  system: number;
  /** RAG 컨텍스트 */
  context: number;
  /** 대화 이력 */
  conversation: number;
  /** 응답 생성 예약 */
  generation: number;
  /** 모델 최대 토큰 */
  maxTokens: number;
}

/** 컨텍스트 청크 */
export interface ContextChunk {
  id: string;
  content: string;
  tokenCount: number;
  source: string;
  /** 벡터 유사도 (0~1) */
  relevance: number;
  /** 시간 감쇠 (0~1, 최신 = 1.0) */
  recency: number;
  /** 소스 중요도 가중치 */
  importance: number;
  /** 최종 우선순위 점수 */
  priorityScore: number;
}

/** 대화 턴 요약 */
export interface ConversationSummary {
  originalTurns: number;
  summary: string;
  tokenCount: number;
}

/** 컨텍스트 압축 전략 — Design §2 */
export type CompressionStrategy = 'extractive' | 'abstractive' | 'map-reduce';

/** 컨텍스트 윈도우 결과 */
export interface ContextWindowResult {
  systemPrompt: string;
  contextChunks: ContextChunk[];
  conversationHistory: string[];
  totalTokens: number;
  budget: TokenBudget;
  compressionApplied: boolean;
  droppedChunks: number;
}

/** 모델별 토큰 한도 */
const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4': 128000,
  'gpt-4o': 128000,
  'claude-3': 200000,
  'claude-sonnet': 200000,
  'local': 32000,
  'default': 32000,
};

// ── 토큰 예산 관리 — Design §1 ─────────────────────────────────────────────

/** 모델에 맞는 토큰 예산 생성 */
export function createTokenBudget(model: string, overrides?: Partial<TokenBudget>): TokenBudget {
  const maxTokens = MODEL_TOKEN_LIMITS[model] ?? MODEL_TOKEN_LIMITS['default'] ?? 32000;

  const budget: TokenBudget = {
    system: Math.floor(maxTokens * 0.12),
    context: Math.floor(maxTokens * 0.45),
    conversation: Math.floor(maxTokens * 0.25),
    generation: Math.floor(maxTokens * 0.18),
    maxTokens,
    ...overrides,
  };

  // 총합이 maxTokens를 초과하지 않도록 보정
  const total = budget.system + budget.context + budget.conversation + budget.generation;
  if (total > budget.maxTokens) {
    const scale = budget.maxTokens / total;
    budget.system = Math.floor(budget.system * scale);
    budget.context = Math.floor(budget.context * scale);
    budget.conversation = Math.floor(budget.conversation * scale);
    budget.generation = Math.floor(budget.generation * scale);
  }

  return budget;
}

// ── 토큰 수 추정 ────────────────────────────────────────────────────────────

/** 토큰 수 추정 (한글 2토큰, 영문 0.4토큰/char) */
export function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\u3131-\uD79D]/g) ?? []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars * 2 + otherChars * 0.4);
}

// ── 청크 우선순위 — Design §3 ──────────────────────────────────────────────

/** 소스 중요도 가중치 */
const SOURCE_IMPORTANCE: Record<string, number> = {
  'regulation': 1.0,
  'government_doc': 0.9,
  'policy': 0.85,
  'manual': 0.7,
  'faq': 0.6,
  'general': 0.4,
};

/** 청크 우선순위 점수 계산 */
export function calculatePriority(chunk: Omit<ContextChunk, 'priorityScore'>): number {
  const relevanceWeight = 0.5;
  const recencyWeight = 0.2;
  const importanceWeight = 0.3;

  return chunk.relevance * relevanceWeight +
    chunk.recency * recencyWeight +
    chunk.importance * importanceWeight;
}

/** 청크 목록을 우선순위 순으로 정렬 */
export function prioritizeChunks(chunks: ContextChunk[]): ContextChunk[] {
  return [...chunks].sort((a, b) => b.priorityScore - a.priorityScore);
}

/** 시간 감쇠 계산 (최근일수록 1에 가까움) */
export function calculateRecency(timestamp: string, halfLifeDays = 30): number {
  const age = Date.now() - Date.parse(timestamp);
  const halfLifeMs = halfLifeDays * 86400000;
  return Math.exp(-0.693 * age / halfLifeMs);
}

/** 소스 중요도 조회 */
export function getSourceImportance(source: string): number {
  return SOURCE_IMPORTANCE[source] ?? 0.5;
}

// ── 컨텍스트 압축 — Design §2 ──────────────────────────────────────────────

/**
 * Extractive 압축: 핵심 문장만 추출
 * 간단하고 빠름, 토큰 50~70% 절감
 */
export function extractiveCompress(text: string, maxTokens: number): string {
  const sentences = text.split(/[.!?。]\s*/).filter((s) => s.trim().length > 5);
  if (sentences.length === 0) return text;

  // 문장 점수: 길이 + 키워드 밀도
  const scored = sentences.map((s) => {
    const keywordCount = (s.match(/[\uAC00-\uD7A3]{2,}/g) ?? []).length;
    const score = keywordCount / Math.max(s.length, 1) * 100;
    return { text: s, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const result: string[] = [];
  let currentTokens = 0;

  for (const item of scored) {
    const tokens = estimateTokens(item.text);
    if (currentTokens + tokens > maxTokens) break;
    result.push(item.text);
    currentTokens += tokens;
  }

  return result.join('. ') + '.';
}

/**
 * Map-Reduce 압축: 청크별 핵심 추출 → 병합
 */
export function mapReduceCompress(chunks: string[], maxTokensPerChunk: number): string {
  const compressed = chunks.map((chunk) => extractiveCompress(chunk, maxTokensPerChunk));
  return compressed.join('\n\n');
}

// ── 슬라이딩 윈도우 — Design §4 ────────────────────────────────────────────

/**
 * 대화 이력에 슬라이딩 윈도우 적용
 * 최근 N턴은 원본 보존, 이전 턴은 요약으로 대체
 */
export function applyConversationWindow(
  turns: string[],
  maxTokens: number,
  preserveRecent = 4,
): { kept: string[]; summarized: string; totalTokens: number } {
  if (turns.length === 0) {
    return { kept: [], summarized: '', totalTokens: 0 };
  }

  // 최근 N턴 보존
  const recentTurns = turns.slice(-preserveRecent);
  const olderTurns = turns.slice(0, -preserveRecent);

  const recentTokens = recentTurns.reduce((sum, t) => sum + estimateTokens(t), 0);

  // 남은 예산으로 이전 턴 요약
  const remainingTokens = maxTokens - recentTokens;
  let summarized = '';

  if (olderTurns.length > 0 && remainingTokens > 50) {
    const combined = olderTurns.join('\n');
    summarized = extractiveCompress(combined, Math.min(remainingTokens, 500));
  }

  const totalTokens = recentTokens + estimateTokens(summarized);

  return { kept: recentTurns, summarized, totalTokens };
}

// ── 오버플로우 처리 — Design §5 ────────────────────────────────────────────

/**
 * 컨텍스트 윈도우 오버플로우 처리
 * 예산 초과 시 낮은 우선순위 청크부터 제거
 */
export function handleOverflow(
  chunks: ContextChunk[],
  maxTokens: number,
): { kept: ContextChunk[]; dropped: number } {
  const sorted = prioritizeChunks(chunks);
  const kept: ContextChunk[] = [];
  let totalTokens = 0;
  let dropped = 0;

  for (const chunk of sorted) {
    if (totalTokens + chunk.tokenCount <= maxTokens) {
      kept.push(chunk);
      totalTokens += chunk.tokenCount;
    } else {
      // 마지막 수단: 압축 시도
      const compressed = extractiveCompress(chunk.content, maxTokens - totalTokens);
      const compressedTokens = estimateTokens(compressed);
      if (compressedTokens > 0 && totalTokens + compressedTokens <= maxTokens) {
        kept.push({
          ...chunk,
          content: compressed,
          tokenCount: compressedTokens,
        });
        totalTokens += compressedTokens;
      } else {
        dropped++;
      }
    }
  }

  return { kept, dropped };
}

// ── 통합 컨텍스트 윈도우 빌더 ──────────────────────────────────────────────

/**
 * 통합 컨텍스트 윈도우 구성
 *
 * 1. 토큰 예산 할당
 * 2. 시스템 프롬프트 배치
 * 3. 컨텍스트 청크 우선순위 정렬 + 오버플로우 처리
 * 4. 대화 이력 슬라이딩 윈도우
 * 5. 응답 생성 예약
 */
export function buildContextWindow(
  model: string,
  systemPrompt: string,
  chunks: ContextChunk[],
  conversationTurns: string[],
): ContextWindowResult {
  const budget = createTokenBudget(model);

  // 시스템 프롬프트 토큰 확인
  const systemTokens = estimateTokens(systemPrompt);
  const maskedPrompt = maskPII(systemPrompt);

  // 실제 시스템 프롬프트가 예산 초과 시 조정
  const adjustedBudget = { ...budget };
  if (systemTokens > budget.system) {
    const excess = systemTokens - budget.system;
    adjustedBudget.system = systemTokens;
    adjustedBudget.context = Math.max(budget.context - excess, 0);
  }

  // 컨텍스트 청크 오버플로우 처리
  const { kept: keptChunks, dropped } = handleOverflow(chunks, adjustedBudget.context);

  // 대화 이력 슬라이딩 윈도우
  const conversationResult = applyConversationWindow(
    conversationTurns,
    adjustedBudget.conversation,
  );

  const history: string[] = [];
  if (conversationResult.summarized) {
    history.push(`[이전 대화 요약] ${conversationResult.summarized}`);
  }
  history.push(...conversationResult.kept);

  const totalTokens = systemTokens +
    keptChunks.reduce((sum, c) => sum + c.tokenCount, 0) +
    conversationResult.totalTokens;

  return {
    systemPrompt: maskedPrompt,
    contextChunks: keptChunks,
    conversationHistory: history,
    totalTokens,
    budget: adjustedBudget,
    compressionApplied: dropped > 0 || conversationResult.summarized.length > 0,
    droppedChunks: dropped,
  };
}
