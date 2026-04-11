// 에이전트 세션/장기 메모리 -- FR-ADV2.2, FR-ADV2.3
// Design Ref: SVC-AI-ADV-R2 DESIGN §2
// 세션 메모리: 인메모리 LRU 캐시 (대화 히스토리 최대 20턴)
// 장기 메모리: DB 저장 (세션 요약 -> 다음 세션에서 활용)
// CSAP: D-09 암호화 (PII 마스킹 후 저장), D-12 입력검증, N2SF N-05 O등급 전용

import { maskPII } from './pii-masking.js';
import { getLLMConfig, createLLMProvider } from './llm-provider.js';
import type { LLMMessage } from './llm-provider.js';
import { prisma } from './prisma.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma 모델 미생성 상태
const db = prisma as Record<string, any>;

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface MemoryEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokenCount: number;
}

export interface SessionMemory {
  tenantId: string;
  sessionId: string;
  entries: MemoryEntry[];
  totalTokens: number;
  maxTokens: number;
  /** 오래된 턴 요약 (압축 후) */
  summary?: string;
}

// ── 세션 메모리 캐시 ──────────────────────────────────────────────────────

/** 세션 메모리 인메모리 LRU 캐시 */
const sessionCache = new Map<string, SessionMemory>();
const SESSION_CACHE_MAX_SIZE = 200;
const SESSION_MAX_ENTRIES = 20;
const SESSION_DEFAULT_MAX_TOKENS = 4096;

/**
 * 세션 메모리 키 생성 (테넌트 격리)
 */
function sessionKey(tenantId: string, sessionId: string): string {
  return `${tenantId}::${sessionId}`;
}

// ── 세션 메모리 API ────────────────────────────────────────────────────────

/**
 * 세션 메모리 조회 또는 생성
 * Plan SC: FR-ADV2.2
 */
export function getOrCreateSession(
  tenantId: string,
  sessionId: string,
  maxTokens = SESSION_DEFAULT_MAX_TOKENS,
): SessionMemory {
  const key = sessionKey(tenantId, sessionId);
  const existing = sessionCache.get(key);
  if (existing) return existing;

  const session: SessionMemory = {
    tenantId,
    sessionId,
    entries: [],
    totalTokens: 0,
    maxTokens,
  };

  // LRU 캐시 관리
  if (sessionCache.size >= SESSION_CACHE_MAX_SIZE) {
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey !== undefined) {
      sessionCache.delete(oldestKey);
    }
  }
  sessionCache.set(key, session);
  return session;
}

/**
 * 세션 메모리에 메시지 추가
 * Plan SC: FR-ADV2.2
 *
 * PII 마스킹 후 저장, 토큰 예산 초과 시 자동 압축
 */
export async function addToMemory(
  session: SessionMemory,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  const maskedContent = maskPII(content);
  const tokenCount = Math.ceil(maskedContent.length / 2);

  const entry: MemoryEntry = {
    role,
    content: maskedContent,
    timestamp: Date.now(),
    tokenCount,
  };

  session.entries.push(entry);
  session.totalTokens += tokenCount;

  // 최대 턴 수 초과 시 자동 압축
  if (session.entries.length > SESSION_MAX_ENTRIES) {
    await compressMemory(session);
  }

  // 토큰 예산 초과 시 자동 압축
  if (session.totalTokens > session.maxTokens) {
    await compressMemory(session);
  }
}

/**
 * 세션 메모리를 LLM 메시지 배열로 변환
 * Plan SC: FR-ADV2.2
 *
 * 요약이 있으면 시스템 메시지로 주입
 */
export function memoryToMessages(session: SessionMemory): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // 이전 대화 요약이 있으면 맥락으로 주입
  if (session.summary) {
    messages.push({
      role: 'system',
      content: `[이전 대화 요약]\n${session.summary}`,
    });
  }

  // 현재 세션 대화 이력
  for (const entry of session.entries) {
    messages.push({
      role: entry.role,
      content: entry.content,
    });
  }

  return messages;
}

// ── 메모리 압축 ────────────────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `당신은 대화 요약 전문가입니다.
이전 대화 내용을 2~3문장으로 간결하게 요약하세요.
핵심 주제, 요청 사항, 결론만 포함하세요.
개인정보는 포함하지 마세요.
한국어로 작성하세요.`;

/**
 * 세션 메모리 압축: 오래된 50% 턴을 요약으로 대체
 * Plan SC: FR-ADV2.2
 */
async function compressMemory(session: SessionMemory): Promise<void> {
  const halfIndex = Math.ceil(session.entries.length / 2);
  const oldEntries = session.entries.slice(0, halfIndex);
  const recentEntries = session.entries.slice(halfIndex);

  // 오래된 턴을 텍스트로 변환
  const oldText = oldEntries
    .map((e) => `${e.role === 'user' ? '사용자' : 'AI'}: ${e.content}`)
    .join('\n');

  try {
    const llmConfig = getLLMConfig();
    const provider = await createLLMProvider(llmConfig);
    const response = await provider.chat(
      [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: `다음 대화를 요약해주세요:\n\n${oldText}` },
      ],
      { maxTokens: 256, temperature: 0.1 },
    );

    // 기존 요약 + 새 요약 합산
    session.summary = session.summary
      ? `${session.summary}\n${response.text.trim()}`
      : response.text.trim();
  } catch {
    // LLM 실패 시 간단 텍스트 요약
    session.summary = session.summary
      ? `${session.summary}\n[대화 ${oldEntries.length}턴 생략]`
      : `[대화 ${oldEntries.length}턴 생략]`;
  }

  // 최근 턴만 유지
  session.entries = recentEntries;
  session.totalTokens = recentEntries.reduce((sum, e) => sum + e.tokenCount, 0);
}

// ── 장기 메모리 (DB) ──────────────────────────────────────────────────────

/**
 * 세션 종료 시 장기 메모리에 저장
 * Plan SC: FR-ADV2.3
 *
 * 전체 세션을 요약하여 DB에 보존
 */
export async function saveToLongTermMemory(
  session: SessionMemory,
): Promise<void> {
  if (session.entries.length === 0 && !session.summary) return;

  // 전체 대화를 요약
  const fullText = session.entries
    .map((e) => `${e.role === 'user' ? '사용자' : 'AI'}: ${e.content}`)
    .join('\n');

  let finalSummary = session.summary ?? '';

  if (fullText.length > 0) {
    try {
      const llmConfig = getLLMConfig();
      const provider = await createLLMProvider(llmConfig);
      const response = await provider.chat(
        [
          { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: `다음 대화를 요약해주세요:\n\n${fullText}` },
        ],
        { maxTokens: 256, temperature: 0.1 },
      );
      finalSummary = finalSummary
        ? `${finalSummary}\n${response.text.trim()}`
        : response.text.trim();
    } catch {
      finalSummary = finalSummary || `세션 ${session.sessionId} 대화 ${session.entries.length}턴`;
    }
  }

  // DB 저장 (테넌트 격리)
  try {
    await db['aiAgentMemory']?.create({
      data: {
        tenantId: session.tenantId,
        sessionId: session.sessionId,
        summary: maskPII(finalSummary),
        turnCount: session.entries.length,
        createdAt: new Date(),
      },
    });
  } catch {
    // DB 테이블 미존재 시 무시 (graceful degradation)
  }
}

/**
 * 장기 메모리에서 이전 세션 요약 로드
 * Plan SC: FR-ADV2.3
 *
 * @param maxSessions 로드할 최근 세션 수 (기본 3)
 */
export async function loadLongTermMemory(
  tenantId: string,
  maxSessions = 3,
): Promise<string | undefined> {
  try {
    const memories = await db['aiAgentMemory']?.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: maxSessions,
      select: { summary: true, createdAt: true },
    });

    if (!memories || (memories as unknown[]).length === 0) return undefined;

    const summaries = (memories as Array<Record<string, unknown>>)
      .reverse() // 시간순 정렬
      .map((m) => String(m['summary'] ?? ''))
      .filter((s) => s.length > 0);

    return summaries.length > 0
      ? `[이전 세션 기억]\n${summaries.join('\n---\n')}`
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 세션 메모리 삭제
 */
export function clearSession(tenantId: string, sessionId: string): void {
  sessionCache.delete(sessionKey(tenantId, sessionId));
}

/**
 * 전체 세션 캐시 초기화
 */
export function clearAllSessions(): void {
  sessionCache.clear();
}
