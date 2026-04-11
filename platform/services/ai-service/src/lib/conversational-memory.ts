// 다중 세션 대화 기억 — FR-ADV11.1~11.5
// Design Ref: SVC-AI-ADV-R11 DESIGN §1~§4
// Plan SC: SC-1 (단기 메모리), SC-2 (장기 메모리), SC-3 (작업 메모리), SC-4 (컨텍스트 주입)
// CSAP: D-09 암호화 (PII 마스킹), D-06 감사 로깅
// N2SF: N-05 O등급 데이터만 처리

import { maskPII } from './pii-masking.js';
import type { LLMMessage } from './llm-provider.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 단기 메모리 턴 */
export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenEstimate: number;
}

/** 장기 메모리 요약 */
export interface LongTermMemory {
  sessionId: string;
  summary: string;
  embedding: number[];
  createdAt: number;
  keyEntities: string[];
  topicTags: string[];
}

/** 작업 메모리 엔티티 */
export interface EntityMemory {
  name: string;
  type: 'person' | 'organization' | 'case' | 'date' | 'document' | 'regulation';
  value: string;
  lastMentioned: number;
  confidence: number;
}

/** 컨텍스트 주입 결과 */
export interface MemoryContext {
  /** 관련 장기 메모리 요약 */
  relevantSummaries: string[];
  /** 활성 엔티티 목록 */
  activeEntities: EntityMemory[];
  /** 주입할 시스템 메시지 */
  systemMessage: string;
  /** 총 토큰 사용량 */
  totalTokens: number;
}

/** 메모리 설정 */
export interface ConversationalMemoryConfig {
  /** 단기 메모리 최대 턴 수 (기본 20) */
  maxShortTermTurns: number;
  /** 단기 메모리 최대 토큰 (기본 4096) */
  maxShortTermTokens: number;
  /** 장기 메모리 검색 상위 N건 (기본 3) */
  longTermTopK: number;
  /** 장기 메모리 유사도 임계값 (기본 0.75) */
  longTermSimilarityThreshold: number;
  /** 엔티티 최대 개수 (기본 20) */
  maxEntities: number;
  /** 컨텍스트 토큰 예산 (기본 1024) */
  contextTokenBudget: number;
}

const DEFAULT_CONFIG: ConversationalMemoryConfig = {
  maxShortTermTurns: 20,
  maxShortTermTokens: 4096,
  longTermTopK: 3,
  longTermSimilarityThreshold: 0.75,
  maxEntities: 20,
  contextTokenBudget: 1024,
};

// ── 단기 메모리 (Buffer Window) — Design §1 ─────────────────────────────────

/**
 * 슬라이딩 윈도우 단기 메모리
 * 최근 N턴을 원본 보존하며, 토큰 한도 초과 시 오래된 턴부터 제거
 */
export class ShortTermMemory {
  private readonly turns: ConversationTurn[] = [];
  private readonly config: ConversationalMemoryConfig;
  private totalTokens = 0;

  constructor(config: Partial<ConversationalMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 턴 추가 */
  addTurn(role: 'user' | 'assistant', content: string): void {
    const tokenEstimate = this.estimateTokens(content);
    this.turns.push({
      role,
      content,
      timestamp: Date.now(),
      tokenEstimate,
    });
    this.totalTokens += tokenEstimate;

    // 턴 수 초과 시 가장 오래된 턴 제거
    while (this.turns.length > this.config.maxShortTermTurns) {
      const removed = this.turns.shift();
      if (removed) {
        this.totalTokens -= removed.tokenEstimate;
      }
    }

    // 토큰 초과 시 가장 오래된 턴 제거
    while (this.totalTokens > this.config.maxShortTermTokens && this.turns.length > 2) {
      const removed = this.turns.shift();
      if (removed) {
        this.totalTokens -= removed.tokenEstimate;
      }
    }
  }

  /** 현재 턴 목록 반환 */
  getTurns(): ConversationTurn[] {
    return [...this.turns];
  }

  /** LLM 메시지 형태로 변환 */
  toMessages(): LLMMessage[] {
    return this.turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));
  }

  /** 전체 대화를 텍스트로 직렬화 (요약 생성용) */
  serialize(): string {
    return this.turns
      .map((t) => `[${t.role}]: ${maskPII(t.content)}`)
      .join('\n');
  }

  /** 턴 수 */
  get length(): number {
    return this.turns.length;
  }

  /** 총 토큰 수 */
  get tokenCount(): number {
    return this.totalTokens;
  }

  /** 초기화 */
  clear(): void {
    this.turns.length = 0;
    this.totalTokens = 0;
  }

  /** 토큰 수 추정 (한글 1자 ≈ 2토큰, 영문 1단어 ≈ 1.3토큰) */
  private estimateTokens(text: string): number {
    const koreanChars = (text.match(/[\u3131-\uD79D]/g) ?? []).length;
    const otherChars = text.length - koreanChars;
    return Math.ceil(koreanChars * 2 + otherChars * 0.4);
  }
}

// ── 장기 메모리 (Summary + Vector) — Design §2 ──────────────────────────────

/**
 * 장기 메모리 저장소
 * 세션 종료 시 대화를 요약하고 임베딩하여 저장
 * 새 세션에서 유사 과거 대화를 검색
 */
export class LongTermMemoryStore {
  private readonly memories: Map<string, LongTermMemory[]> = new Map();
  private readonly config: ConversationalMemoryConfig;

  constructor(config: Partial<ConversationalMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 장기 메모리 저장 (세션 종료 시 호출) */
  store(tenantUserId: string, memory: LongTermMemory): void {
    const existing = this.memories.get(tenantUserId) ?? [];
    existing.push(memory);
    // 최대 100개 유지 (LRU)
    if (existing.length > 100) {
      existing.shift();
    }
    this.memories.set(tenantUserId, existing);
  }

  /** 유사 과거 대화 검색 (코사인 유사도 기반) */
  search(tenantUserId: string, queryEmbedding: number[]): LongTermMemory[] {
    const memories = this.memories.get(tenantUserId) ?? [];

    const scored = memories
      .map((mem) => ({
        memory: mem,
        similarity: cosineSimilarity(queryEmbedding, mem.embedding),
      }))
      .filter((item) => item.similarity >= this.config.longTermSimilarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.config.longTermTopK);

    return scored.map((s) => s.memory);
  }

  /** 특정 사용자 메모리 전체 삭제 (GDPR/개인정보보호법 준수) */
  deleteAll(tenantUserId: string): number {
    const count = this.memories.get(tenantUserId)?.length ?? 0;
    this.memories.delete(tenantUserId);
    return count;
  }

  /** 메모리 수 */
  count(tenantUserId: string): number {
    return this.memories.get(tenantUserId)?.length ?? 0;
  }
}

// ── 작업 메모리 (Entity Tracking) — Design §3 ───────────────────────────────

/**
 * 작업 메모리: 대화 중 핵심 엔티티를 추적
 * 이름, 건명, 날짜, 문서번호 등을 자동 추출하여 현재 상태 유지
 */
export class EntityTracker {
  private readonly entities: Map<string, EntityMemory> = new Map();
  private readonly config: ConversationalMemoryConfig;

  constructor(config: Partial<ConversationalMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 엔티티 업데이트/추가 */
  upsert(entity: EntityMemory): void {
    const key = `${entity.type}:${entity.name}`;
    this.entities.set(key, { ...entity, lastMentioned: Date.now() });

    // 최대 개수 초과 시 가장 오래된 것 제거
    if (this.entities.size > this.config.maxEntities) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this.entities) {
        if (v.lastMentioned < oldestTime) {
          oldestTime = v.lastMentioned;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.entities.delete(oldestKey);
      }
    }
  }

  /** 활성 엔티티 목록 (최근 언급순 정렬) */
  getActive(): EntityMemory[] {
    return [...this.entities.values()]
      .sort((a, b) => b.lastMentioned - a.lastMentioned);
  }

  /** 텍스트에서 엔티티 추출 (규칙 기반 — LLM 호출 없이) */
  extractFromText(text: string): EntityMemory[] {
    const extracted: EntityMemory[] = [];

    // 날짜 패턴 (YYYY-MM-DD, YYYY.MM.DD, YYYY년 MM월 DD일)
    const datePattern = /(\d{4}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}일?)/g;
    for (const match of text.matchAll(datePattern)) {
      const captured: string | undefined = match[1];
      if (captured !== undefined) {
        const trimmed = captured.trim();
        extracted.push({
          name: trimmed,
          type: 'date',
          value: trimmed,
          lastMentioned: Date.now(),
          confidence: 0.9,
        });
      }
    }

    // 법령 패턴 (XX법, XX규정, XX조례)
    const regulationPattern = /((?:[\uAC00-\uD7A3]+){2,}(?:법|규정|조례|시행령|시행규칙|고시|훈령))/g;
    for (const match of text.matchAll(regulationPattern)) {
      const captured: string | undefined = match[1];
      if (captured !== undefined) {
        extracted.push({
          name: captured,
          type: 'regulation',
          value: captured,
          lastMentioned: Date.now(),
          confidence: 0.85,
        });
      }
    }

    // 문서번호 패턴 (XX-YYYY-NNNN)
    const docNumberPattern = /([A-Z가-힣]+-\d{4}-\d{3,6})/g;
    for (const match of text.matchAll(docNumberPattern)) {
      const captured: string | undefined = match[1];
      if (captured !== undefined) {
        extracted.push({
          name: captured,
          type: 'document',
          value: captured,
          lastMentioned: Date.now(),
          confidence: 0.95,
        });
      }
    }

    // 추출된 엔티티 자동 등록
    for (const entity of extracted) {
      this.upsert(entity);
    }

    return extracted;
  }

  /** 초기화 */
  clear(): void {
    this.entities.clear();
  }

  /** 엔티티 수 */
  get size(): number {
    return this.entities.size;
  }
}

// ── 컨텍스트 주입 — Design §4 ───────────────────────────────────────────────

/**
 * 메모리 컨텍스트를 시스템 메시지로 조합
 * 토큰 예산 내에서 관련 장기 메모리와 활성 엔티티를 포함
 */
export function buildMemoryContext(
  longTermMemories: LongTermMemory[],
  activeEntities: EntityMemory[],
  config: Partial<ConversationalMemoryConfig> = {},
): MemoryContext {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const parts: string[] = [];
  let tokenCount = 0;

  // 장기 메모리 요약 주입
  if (longTermMemories.length > 0) {
    parts.push('## 관련 과거 대화');
    for (const mem of longTermMemories) {
      const summaryText = maskPII(mem.summary);
      const summaryTokens = estimateTokens(summaryText);
      if (tokenCount + summaryTokens <= mergedConfig.contextTokenBudget) {
        parts.push(`- [${new Date(mem.createdAt).toLocaleDateString('ko-KR')}] ${summaryText}`);
        tokenCount += summaryTokens;
      }
    }
  }

  // 활성 엔티티 주입
  if (activeEntities.length > 0) {
    const entityPart = '## 현재 대화 엔티티\n' +
      activeEntities
        .slice(0, 10) // 최대 10개
        .map((e) => `- ${e.type}: ${maskPII(e.value)}`)
        .join('\n');
    const entityTokens = estimateTokens(entityPart);
    if (tokenCount + entityTokens <= mergedConfig.contextTokenBudget) {
      parts.push(entityPart);
      tokenCount += entityTokens;
    }
  }

  const systemMessage = parts.length > 0
    ? `[대화 기억]\n${parts.join('\n\n')}`
    : '';

  return {
    relevantSummaries: longTermMemories.map((m) => m.summary),
    activeEntities,
    systemMessage,
    totalTokens: tokenCount,
  };
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

/** 코사인 유사도 계산 */
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

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/** 토큰 수 추정 */
function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\u3131-\uD79D]/g) ?? []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars * 2 + otherChars * 0.4);
}
