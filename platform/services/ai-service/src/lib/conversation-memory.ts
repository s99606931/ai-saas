// 다중 세션 대화 메모리 — FR-ADV11.1~FR-ADV11.6
// Design Ref: SVC-AI-ADV-R11 DESIGN §1~§4
// Plan SC: SC-1~SC-4
// CSAP: D-08 접근 통제 (사용자별 격리), D-06 감사
// N2SF: N-05 O등급 데이터만 처리, PII 마스킹

import type { LLMMessage } from './llm-provider.js';
import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 대화 턴 */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** 세션 요약 (장기 메모리) */
export interface SessionSummary {
  sessionId: string;
  summary: string;
  embedding?: number[];
  entities: Record<string, string>;
  createdAt: number;
  turnCount: number;
}

/** 엔티티 (작업 메모리) */
export interface ConversationEntity {
  name: string;
  value: string;
  category: 'person' | 'topic' | 'date' | 'reference' | 'action' | 'other';
  lastUpdated: number;
}

/** 메모리 검색 결과 */
export interface MemorySearchResult {
  type: 'short_term' | 'long_term' | 'entity';
  content: string;
  relevanceScore: number;
  source: string;
}

/** 컨텍스트 주입 결과 */
export interface MemoryContext {
  /** 시스템 프롬프트에 추가할 메모리 텍스트 */
  memoryPrompt: string;
  /** 최근 대화 턴 (단기 메모리) */
  recentTurns: LLMMessage[];
  /** 관련 과거 대화 요약 (장기 메모리) */
  relatedSummaries: string[];
  /** 현재 엔티티 상태 (작업 메모리) */
  entities: Record<string, string>;
  /** 사용된 토큰 수 (추정) */
  estimatedTokens: number;
}

/** 메모리 설정 */
export interface ConversationMemoryConfig {
  /** 단기 메모리 최대 턴 수 (기본 20) */
  maxShortTermTurns?: number;
  /** 장기 메모리 최대 세션 수 (기본 100) */
  maxLongTermSessions?: number;
  /** 엔티티 최대 수 (기본 50) */
  maxEntities?: number;
  /** 장기 메모리 TTL (ms, 기본 30일) */
  longTermTTLMs?: number;
  /** 컨텍스트 주입 최대 토큰 (기본 2000) */
  maxContextTokens?: number;
  /** 유사도 임계값 (기본 0.7) */
  similarityThreshold?: number;
}

const DEFAULT_CONFIG: Required<ConversationMemoryConfig> = {
  maxShortTermTurns: 20,
  maxLongTermSessions: 100,
  maxEntities: 50,
  longTermTTLMs: 30 * 24 * 60 * 60 * 1000, // 30일
  maxContextTokens: 2000,
  similarityThreshold: 0.7,
};

// ── 임베딩/요약 함수 인터페이스 ──────────────────────────────────────────────

/** 임베딩 함수 (DIP) */
export type EmbedFn = (text: string) => Promise<number[]>;

/** 요약 함수 (DIP) */
export type SummarizeFn = (turns: ConversationTurn[]) => Promise<string>;

/** 엔티티 추출 함수 (DIP) */
export type ExtractEntitiesFn = (text: string) => Promise<Array<{ name: string; value: string; category: ConversationEntity['category'] }>>;

// ── 대화 메모리 ──────────────────────────────────────────────────────────────

/**
 * 다중 세션 대화 메모리
 *
 * 3계층 메모리 구조로 AI가 이전 대화를 기억합니다:
 * - 단기 메모리: 현재 세션의 최근 턴 (슬라이딩 윈도우)
 * - 장기 메모리: 과거 세션 요약 (벡터 검색)
 * - 작업 메모리: 대화 중 핵심 엔티티 추적
 *
 * 사용자별(userId+tenantId) 격리를 보장합니다.
 */
export class ConversationMemory {
  private readonly config: Required<ConversationMemoryConfig>;
  private readonly embedFn?: EmbedFn;
  private readonly summarizeFn?: SummarizeFn;
  private readonly extractEntitiesFn?: ExtractEntitiesFn;

  // 사용자별 저장소 (userId → 데이터)
  private shortTermMemory: Map<string, ConversationTurn[]> = new Map();
  private longTermMemory: Map<string, SessionSummary[]> = new Map();
  private entityMemory: Map<string, Map<string, ConversationEntity>> = new Map();

  constructor(
    config?: ConversationMemoryConfig,
    deps?: {
      embedFn?: EmbedFn;
      summarizeFn?: SummarizeFn;
      extractEntitiesFn?: ExtractEntitiesFn;
    },
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embedFn = deps?.embedFn;
    this.summarizeFn = deps?.summarizeFn;
    this.extractEntitiesFn = deps?.extractEntitiesFn;
  }

  // ── 단기 메모리 — FR-ADV11.1 ──────────────────────────────────────

  /**
   * 대화 턴을 단기 메모리에 추가합니다
   */
  async addTurn(userId: string, turn: ConversationTurn): Promise<void> {
    const turns = this.getShortTermTurns(userId);
    turns.push(turn);

    // 슬라이딩 윈도우 — 최대 턴 수 유지
    while (turns.length > this.config.maxShortTermTurns) {
      turns.shift();
    }

    this.shortTermMemory.set(userId, turns);

    // 엔티티 추출 — FR-ADV11.3
    if (this.extractEntitiesFn && turn.role === 'user') {
      await this.extractAndUpdateEntities(userId, turn.content);
    }
  }

  /**
   * 단기 메모리의 최근 턴을 반환합니다
   */
  getShortTermTurns(userId: string): ConversationTurn[] {
    return this.shortTermMemory.get(userId) ?? [];
  }

  // ── 장기 메모리 — FR-ADV11.2 ──────────────────────────────────────

  /**
   * 현재 세션을 요약하여 장기 메모리에 저장합니다
   * (세션 종료 시 호출)
   */
  async commitSession(userId: string, sessionId: string): Promise<SessionSummary | null> {
    const turns = this.getShortTermTurns(userId);
    if (turns.length === 0) return null;

    // 요약 생성
    let summary: string;
    if (this.summarizeFn) {
      summary = await this.summarizeFn(turns);
    } else {
      // 간이 요약 (LLM 미사용)
      summary = turns
        .filter((t) => t.role === 'user')
        .map((t) => t.content.slice(0, 100))
        .join(' | ');
    }

    // PII 마스킹
    summary = maskPII(summary);

    // 임베딩 생성 (있으면)
    let embedding: number[] | undefined;
    if (this.embedFn) {
      embedding = await this.embedFn(summary);
    }

    // 엔티티 수집
    const entityMap = this.entityMemory.get(userId) ?? new Map();
    const entities: Record<string, string> = {};
    for (const [key, entity] of entityMap) {
      entities[key] = entity.value;
    }

    const sessionSummary: SessionSummary = {
      sessionId,
      summary,
      embedding,
      entities,
      createdAt: Date.now(),
      turnCount: turns.length,
    };

    // 장기 메모리에 저장
    const summaries = this.longTermMemory.get(userId) ?? [];
    summaries.push(sessionSummary);

    // LRU: 최대 세션 수 유지
    while (summaries.length > this.config.maxLongTermSessions) {
      summaries.shift();
    }

    this.longTermMemory.set(userId, summaries);

    // 단기 메모리 초기화
    this.shortTermMemory.delete(userId);

    return sessionSummary;
  }

  /**
   * 과거 대화에서 현재 질문과 관련된 요약을 검색합니다 — FR-ADV11.4
   */
  async searchRelatedMemories(userId: string, query: string, topK: number = 3): Promise<MemorySearchResult[]> {
    const summaries = this.longTermMemory.get(userId) ?? [];
    if (summaries.length === 0) return [];

    const results: MemorySearchResult[] = [];

    if (this.embedFn) {
      // 벡터 유사도 기반 검색
      const queryEmbedding = await this.embedFn(maskPII(query));

      for (const summary of summaries) {
        if (!summary.embedding) continue;

        const similarity = cosineSimilarity(queryEmbedding, summary.embedding);
        if (similarity >= this.config.similarityThreshold) {
          results.push({
            type: 'long_term',
            content: summary.summary,
            relevanceScore: similarity,
            source: `세션 ${summary.sessionId} (${new Date(summary.createdAt).toLocaleDateString('ko-KR')})`,
          });
        }
      }
    } else {
      // 키워드 기반 간이 검색
      const queryLower = query.toLowerCase();
      for (const summary of summaries) {
        const summaryLower = summary.summary.toLowerCase();
        const overlap = queryLower.split(/\s+/).filter((w) => summaryLower.includes(w)).length;
        const score = overlap / Math.max(1, queryLower.split(/\s+/).length);

        if (score >= 0.2) {
          results.push({
            type: 'long_term',
            content: summary.summary,
            relevanceScore: score,
            source: `세션 ${summary.sessionId}`,
          });
        }
      }
    }

    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);
  }

  // ── 작업 메모리 — FR-ADV11.3 ──────────────────────────────────────

  /**
   * 엔티티를 수동으로 설정합니다
   */
  setEntity(userId: string, name: string, value: string, category: ConversationEntity['category'] = 'other'): void {
    const entityMap = this.entityMemory.get(userId) ?? new Map();
    entityMap.set(name, { name, value: maskPII(value), category, lastUpdated: Date.now() });

    // 최대 엔티티 수 유지
    if (entityMap.size > this.config.maxEntities) {
      // 가장 오래된 엔티티 제거
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entity] of entityMap) {
        if (entity.lastUpdated < oldestTime) {
          oldestTime = entity.lastUpdated;
          oldestKey = key;
        }
      }
      if (oldestKey) entityMap.delete(oldestKey);
    }

    this.entityMemory.set(userId, entityMap);
  }

  /**
   * 현재 엔티티 상태를 반환합니다
   */
  getEntities(userId: string): Record<string, string> {
    const entityMap = this.entityMemory.get(userId) ?? new Map();
    const result: Record<string, string> = {};
    for (const [key, entity] of entityMap) {
      result[key] = entity.value;
    }
    return result;
  }

  private async extractAndUpdateEntities(userId: string, text: string): Promise<void> {
    if (!this.extractEntitiesFn) return;

    try {
      const extracted = await this.extractEntitiesFn(text);
      for (const entity of extracted) {
        this.setEntity(userId, entity.name, entity.value, entity.category);
      }
    } catch {
      // 엔티티 추출 실패는 무시 (비핵심 기능)
    }
  }

  // ── 컨텍스트 주입 — FR-ADV11.6, Design §4 ────────────────────────

  /**
   * 현재 질문에 대한 메모리 컨텍스트를 생성합니다
   *
   * 시스템 프롬프트에 주입할 메모리 정보를 구성합니다.
   * 토큰 예산 내에서 최대한 많은 관련 메모리를 포함합니다.
   */
  async buildContext(userId: string, currentQuery: string): Promise<MemoryContext> {
    const recentTurns: LLMMessage[] = [];
    const relatedSummaries: string[] = [];
    const entities = this.getEntities(userId);
    let estimatedTokens = 0;
    const tokenBudget = this.config.maxContextTokens;

    // 1. 엔티티 (작업 메모리) — 가장 중요, 적은 토큰
    const entityLines: string[] = [];
    for (const [key, value] of Object.entries(entities)) {
      const line = `- ${key}: ${value}`;
      const lineTokens = estimateTokens(line);
      if (estimatedTokens + lineTokens <= tokenBudget) {
        entityLines.push(line);
        estimatedTokens += lineTokens;
      }
    }

    // 2. 관련 과거 대화 (장기 메모리)
    const searchResults = await this.searchRelatedMemories(userId, currentQuery, 3);
    for (const result of searchResults) {
      const summaryTokens = estimateTokens(result.content);
      if (estimatedTokens + summaryTokens <= tokenBudget) {
        relatedSummaries.push(result.content);
        estimatedTokens += summaryTokens;
      }
    }

    // 3. 최근 대화 (단기 메모리) — 남은 토큰으로
    const turns = this.getShortTermTurns(userId);
    for (let i = turns.length - 1; i >= 0; i--) {
      const turn = turns[i]!;
      const turnTokens = estimateTokens(turn.content);
      if (estimatedTokens + turnTokens <= tokenBudget) {
        recentTurns.unshift({ role: turn.role, content: turn.content });
        estimatedTokens += turnTokens;
      } else {
        break;
      }
    }

    // 메모리 프롬프트 구성
    const parts: string[] = [];

    if (entityLines.length > 0) {
      parts.push(`[현재 대화 상태]\n${entityLines.join('\n')}`);
    }

    if (relatedSummaries.length > 0) {
      parts.push(`[관련 과거 대화]\n${relatedSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
    }

    return {
      memoryPrompt: parts.length > 0 ? parts.join('\n\n') : '',
      recentTurns,
      relatedSummaries,
      entities,
      estimatedTokens,
    };
  }

  // ── 메모리 보존 정책 — FR-ADV11.5 ─────────────────────────────────

  /**
   * 사용자의 모든 메모리를 삭제합니다 (GDPR/개인정보 삭제 요청)
   */
  deleteUserMemory(userId: string): void {
    this.shortTermMemory.delete(userId);
    this.longTermMemory.delete(userId);
    this.entityMemory.delete(userId);
  }

  /**
   * 만료된 장기 메모리를 정리합니다
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, summaries] of this.longTermMemory) {
      const filtered = summaries.filter((s) => now - s.createdAt <= this.config.longTermTTLMs);
      cleanedCount += summaries.length - filtered.length;

      if (filtered.length === 0) {
        this.longTermMemory.delete(userId);
      } else {
        this.longTermMemory.set(userId, filtered);
      }
    }

    return cleanedCount;
  }

  /**
   * 메모리 통계
   */
  getStats(): {
    totalUsers: number;
    shortTermTurns: number;
    longTermSessions: number;
    totalEntities: number;
  } {
    let shortTermTurns = 0;
    let longTermSessions = 0;
    let totalEntities = 0;

    for (const turns of this.shortTermMemory.values()) shortTermTurns += turns.length;
    for (const summaries of this.longTermMemory.values()) longTermSessions += summaries.length;
    for (const entities of this.entityMemory.values()) totalEntities += entities.size;

    return {
      totalUsers: new Set([
        ...this.shortTermMemory.keys(),
        ...this.longTermMemory.keys(),
        ...this.entityMemory.keys(),
      ]).size,
      shortTermTurns,
      longTermSessions,
      totalEntities,
    };
  }
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

/** 코사인 유사도 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** 토큰 수 추정 (한국어 1.5 토큰/글자) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length * 1.2); // 한영 혼합 평균
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

export function createConversationMemory(
  config?: ConversationMemoryConfig,
  deps?: {
    embedFn?: EmbedFn;
    summarizeFn?: SummarizeFn;
    extractEntitiesFn?: ExtractEntitiesFn;
  },
): ConversationMemory {
  return new ConversationMemory(config, deps);
}
