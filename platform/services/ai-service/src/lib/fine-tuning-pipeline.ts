// 파인튜닝 데이터 파이프라인 — FR-ADV26.1~26.6
// Design Ref: SVC-AI-ADV-R26 DESIGN §1~§5
// Plan SC: SC-1 (수집), SC-2 (정제), SC-3 (포맷), SC-4 (검증), SC-5 (버전)
// CSAP: D-09 PII 완전 제거, D-06 데이터 처리 감사
// N2SF: N-05 C/S등급 절대 배제

import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 학습 데이터 포맷 — Design §3 */
export type TrainingFormat = 'sft' | 'dpo' | 'ppo';

/** SFT (Supervised Fine-Tuning) 항목 */
export interface SFTEntry {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

/** DPO (Direct Preference Optimization) 항목 */
export interface DPOEntry {
  prompt: string;
  chosen: string;
  rejected: string;
}

/** PPO (Proximal Policy Optimization) 항목 */
export interface PPOEntry {
  query: string;
  response: string;
  reward: number;
}

/** 원시 대화 로그 — Design §1 */
export interface RawConversation {
  id: string;
  tenantId: string;
  messages: Array<{ role: string; content: string }>;
  feedback?: 'positive' | 'negative';
  rating?: number;
  category?: string;
  timestamp: string;
}

/** 정제 결과 — Design §2 */
export interface CleanedEntry {
  id: string;
  messages: Array<{ role: string; content: string }>;
  quality: number;
  category: string;
  tokenCount: number;
  isValid: boolean;
  rejectionReason?: string;
}

/** 데이터셋 통계 — Design §6 */
export interface DatasetStats {
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  avgTokenCount: number;
  minTokenCount: number;
  maxTokenCount: number;
  categoryDistribution: Record<string, number>;
  qualityDistribution: Record<string, number>;
}

/** 데이터셋 버전 — Design §5 */
export interface DatasetVersion {
  id: string;
  name: string;
  format: TrainingFormat;
  entryCount: number;
  stats: DatasetStats;
  createdAt: string;
  checksum: string;
}

// ── 정제 파이프라인 — Design §2 ────────────────────────────────────────────

/** 토큰 수 추정 */
function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\u3131-\uD79D]/g) ?? []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars * 2 + otherChars * 0.4);
}

/**
 * 대화 로그 정제
 *
 * 1. PII 마스킹
 * 2. 품질 필터링 (응답 길이, 언어)
 * 3. 독성 필터링
 */
export function cleanConversation(raw: RawConversation): CleanedEntry {
  const messages = raw.messages.map((m) => ({
    role: m.role,
    content: maskPII(m.content),
  }));

  // 전체 토큰 수
  const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  // 품질 점수 계산
  let quality = 0.5;
  const reasons: string[] = [];

  // 응답 길이 검사 (최소 50자)
  const assistantMsgs = messages.filter((m) => m.role === 'assistant');
  const avgAssistantLen = assistantMsgs.length > 0
    ? assistantMsgs.reduce((s, m) => s + m.content.length, 0) / assistantMsgs.length
    : 0;

  if (avgAssistantLen < 50) {
    quality -= 0.2;
    reasons.push('응답 길이 부족 (50자 미만)');
  } else if (avgAssistantLen >= 100) {
    quality += 0.2;
  }

  // 한국어 비율 검사
  const allText = messages.map((m) => m.content).join('');
  const koreanChars = (allText.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  const koreanRatio = allText.length > 0 ? koreanChars / allText.length : 0;

  if (koreanRatio < 0.3) {
    quality -= 0.15;
    reasons.push('한국어 비율 부족');
  } else {
    quality += 0.1;
  }

  // 독성 필터
  const toxicPatterns = [/욕설/, /비속어/, /혐오/];
  for (const pattern of toxicPatterns) {
    if (pattern.test(allText)) {
      quality -= 0.3;
      reasons.push('독성 콘텐츠 감지');
      break;
    }
  }

  // 피드백 반영
  if (raw.feedback === 'positive') quality += 0.15;
  if (raw.feedback === 'negative') quality -= 0.15;
  if (raw.rating !== undefined) {
    quality += (raw.rating - 3) * 0.1;
  }

  quality = Math.max(0, Math.min(1, quality));
  const isValid = quality >= 0.4 && totalTokens >= 20 && reasons.length < 2;

  return {
    id: raw.id,
    messages,
    quality: Math.round(quality * 100) / 100,
    category: raw.category ?? 'general',
    tokenCount: totalTokens,
    isValid,
    rejectionReason: isValid ? undefined : reasons.join('; '),
  };
}

// ── 포맷 변환 — Design §3 ──────────────────────────────────────────────────

/** SFT 포맷으로 변환 */
export function toSFTFormat(entries: CleanedEntry[]): SFTEntry[] {
  return entries
    .filter((e) => e.isValid)
    .map((e) => ({
      messages: e.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    }));
}

/** DPO 포맷으로 변환 (비교 피드백 필요) */
export function toDPOFormat(
  chosen: CleanedEntry[],
  rejected: CleanedEntry[],
): DPOEntry[] {
  const entries: DPOEntry[] = [];
  const minLen = Math.min(chosen.length, rejected.length);

  for (let i = 0; i < minLen; i++) {
    const c = chosen[i];
    const r = rejected[i];
    if (!c || !r) continue;

    const userMsg = c.messages.find((m) => m.role === 'user');
    const chosenMsg = c.messages.find((m) => m.role === 'assistant');
    const rejectedMsg = r.messages.find((m) => m.role === 'assistant');

    if (userMsg && chosenMsg && rejectedMsg) {
      entries.push({
        prompt: userMsg.content,
        chosen: chosenMsg.content,
        rejected: rejectedMsg.content,
      });
    }
  }

  return entries;
}

/** PPO 포맷으로 변환 */
export function toPPOFormat(entries: CleanedEntry[]): PPOEntry[] {
  return entries
    .filter((e) => e.isValid)
    .map((e) => {
      const userMsg = e.messages.find((m) => m.role === 'user');
      const assistantMsg = e.messages.find((m) => m.role === 'assistant');
      return {
        query: userMsg?.content ?? '',
        response: assistantMsg?.content ?? '',
        reward: e.quality,
      };
    })
    .filter((e) => e.query.length > 0 && e.response.length > 0);
}

// ── 데이터셋 통계 — Design §6 ──────────────────────────────────────────────

/** 데이터셋 통계 계산 */
export function calculateDatasetStats(entries: CleanedEntry[]): DatasetStats {
  const validEntries = entries.filter((e) => e.isValid);
  const tokenCounts = entries.map((e) => e.tokenCount);

  const categoryDist: Record<string, number> = {};
  for (const e of entries) {
    categoryDist[e.category] = (categoryDist[e.category] ?? 0) + 1;
  }

  const qualityBuckets: Record<string, number> = { low: 0, medium: 0, high: 0 };
  for (const e of entries) {
    if (e.quality < 0.4) qualityBuckets['low'] = (qualityBuckets['low'] ?? 0) + 1;
    else if (e.quality < 0.7) qualityBuckets['medium'] = (qualityBuckets['medium'] ?? 0) + 1;
    else qualityBuckets['high'] = (qualityBuckets['high'] ?? 0) + 1;
  }

  return {
    totalEntries: entries.length,
    validEntries: validEntries.length,
    invalidEntries: entries.length - validEntries.length,
    avgTokenCount: tokenCounts.length > 0
      ? Math.round(tokenCounts.reduce((s, t) => s + t, 0) / tokenCounts.length)
      : 0,
    minTokenCount: tokenCounts.length > 0 ? Math.min(...tokenCounts) : 0,
    maxTokenCount: tokenCounts.length > 0 ? Math.max(...tokenCounts) : 0,
    categoryDistribution: categoryDist,
    qualityDistribution: qualityBuckets,
  };
}

// ── 파이프라인 실행 ─────────────────────────────────────────────────────────

/**
 * 파인튜닝 데이터 파이프라인 실행
 * 수집 → 정제 → 통계 → 포맷 변환
 */
export function runFineTuningPipeline(
  rawConversations: RawConversation[],
  format: TrainingFormat,
): {
  cleaned: CleanedEntry[];
  stats: DatasetStats;
  formatted: SFTEntry[] | DPOEntry[] | PPOEntry[];
} {
  // 1. 정제
  const cleaned = rawConversations.map(cleanConversation);

  // 2. 통계
  const stats = calculateDatasetStats(cleaned);

  // 3. 포맷 변환
  let formatted: SFTEntry[] | DPOEntry[] | PPOEntry[];
  switch (format) {
    case 'sft':
      formatted = toSFTFormat(cleaned);
      break;
    case 'dpo':
      // DPO는 쌍이 필요하므로 positive/negative 분리
      formatted = toDPOFormat(
        cleaned.filter((e) => e.quality >= 0.7),
        cleaned.filter((e) => e.quality < 0.4),
      );
      break;
    case 'ppo':
      formatted = toPPOFormat(cleaned);
      break;
  }

  return { cleaned, stats, formatted };
}
