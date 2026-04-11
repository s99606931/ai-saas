// AI 피드백 루프 — FR-ADV19.1~19.6
// Design Ref: SVC-AI-ADV-R19 DESIGN §1~§5
// Plan SC: SC-1 (피드백 수집), SC-2 (비교 피드백), SC-3 (집계), SC-4 (데이터셋), SC-5 (추이)
// CSAP: D-09 피드백 암호화, D-06 감사 로깅
// N2SF: N-05 PII 마스킹 후 저장

import { z } from 'zod';
import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 피드백 유형 */
export type FeedbackType = 'thumbs' | 'rating' | 'text';

/** 피드백 항목 — Design §1 */
export interface FeedbackEntry {
  id: string;
  responseId: string;
  userId: string;
  tenantId: string;
  type: FeedbackType;
  value: string | number;
  query: string;
  response: string;
  model: string;
  promptVersion?: string;
  timestamp: string;
}

/** 비교 피드백 — Design §2 */
export interface ComparisonFeedback {
  id: string;
  userId: string;
  tenantId: string;
  prompt: string;
  responseA: string;
  responseB: string;
  preferred: 'A' | 'B' | 'tie';
  reason?: string;
  modelA: string;
  modelB: string;
  timestamp: string;
}

/** DPO 학습 데이터 포맷 — Design §4 */
export interface DPOEntry {
  prompt: string;
  chosen: string;
  rejected: string;
}

/** 피드백 집계 통계 — Design §3 */
export interface FeedbackAggregation {
  key: string;
  totalCount: number;
  thumbsUp: number;
  thumbsDown: number;
  avgRating: number;
  positiveRate: number;
  nps: number;
  period: string;
}

/** 품질 추이 경고 — Design §5 */
export interface QualityAlert {
  type: 'decline' | 'anomaly';
  severity: 'warning' | 'critical';
  message: string;
  currentScore: number;
  previousScore: number;
  changePercent: number;
  timestamp: string;
}

// ── 입력 검증 스키마 ────────────────────────────────────────────────────────

export const feedbackSchema = z.object({
  responseId: z.string().min(1).max(100),
  type: z.enum(['thumbs', 'rating', 'text']),
  value: z.union([
    z.enum(['up', 'down']),
    z.number().int().min(1).max(5),
    z.string().min(1).max(2000),
  ]),
  query: z.string().min(1).max(5000),
  response: z.string().min(1).max(10000),
  model: z.string().min(1).max(100),
  promptVersion: z.string().optional(),
});

export const comparisonSchema = z.object({
  prompt: z.string().min(1).max(5000),
  responseA: z.string().min(1).max(10000),
  responseB: z.string().min(1).max(10000),
  preferred: z.enum(['A', 'B', 'tie']),
  reason: z.string().max(2000).optional(),
  modelA: z.string().min(1).max(100),
  modelB: z.string().min(1).max(100),
});

// ── 피드백 수집기 — Design §1 ──────────────────────────────────────────────

/** 피드백 저장소 */
export class FeedbackStore {
  private readonly entries: FeedbackEntry[] = [];
  private readonly comparisons: ComparisonFeedback[] = [];

  /** 피드백 추가 */
  addFeedback(
    userId: string,
    tenantId: string,
    data: z.infer<typeof feedbackSchema>,
  ): FeedbackEntry {
    const entry: FeedbackEntry = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      responseId: data.responseId,
      userId,
      tenantId,
      type: data.type,
      value: data.value,
      query: maskPII(data.query),
      response: maskPII(data.response),
      model: data.model,
      promptVersion: data.promptVersion,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  /** 비교 피드백 추가 — Design §2 */
  addComparison(
    userId: string,
    tenantId: string,
    data: z.infer<typeof comparisonSchema>,
  ): ComparisonFeedback {
    const comparison: ComparisonFeedback = {
      id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      tenantId,
      prompt: maskPII(data.prompt),
      responseA: maskPII(data.responseA),
      responseB: maskPII(data.responseB),
      preferred: data.preferred,
      reason: data.reason ? maskPII(data.reason) : undefined,
      modelA: data.modelA,
      modelB: data.modelB,
      timestamp: new Date().toISOString(),
    };
    this.comparisons.push(comparison);
    return comparison;
  }

  /** 피드백 집계 — Design §3 */
  aggregate(
    groupBy: 'model' | 'promptVersion',
    tenantId: string,
  ): FeedbackAggregation[] {
    const tenantEntries = this.entries.filter((e) => e.tenantId === tenantId);
    const groups = new Map<string, FeedbackEntry[]>();

    for (const entry of tenantEntries) {
      const key = groupBy === 'model' ? entry.model : (entry.promptVersion ?? 'default');
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }

    const results: FeedbackAggregation[] = [];
    for (const [key, entries] of groups) {
      const thumbsUp = entries.filter((e) => e.type === 'thumbs' && e.value === 'up').length;
      const thumbsDown = entries.filter((e) => e.type === 'thumbs' && e.value === 'down').length;
      const ratings = entries.filter((e) => e.type === 'rating').map((e) => e.value as number);
      const avgRating = ratings.length > 0
        ? ratings.reduce((s, r) => s + r, 0) / ratings.length
        : 0;
      const thumbsTotal = thumbsUp + thumbsDown;
      const positiveRate = thumbsTotal > 0 ? thumbsUp / thumbsTotal : 0;

      // NPS 계산 (별점 기반: 4-5 = promoter, 3 = passive, 1-2 = detractor)
      const promoters = ratings.filter((r) => r >= 4).length;
      const detractors = ratings.filter((r) => r <= 2).length;
      const nps = ratings.length > 0
        ? ((promoters - detractors) / ratings.length) * 100
        : 0;

      results.push({
        key,
        totalCount: entries.length,
        thumbsUp,
        thumbsDown,
        avgRating: Math.round(avgRating * 100) / 100,
        positiveRate: Math.round(positiveRate * 1000) / 1000,
        nps: Math.round(nps * 10) / 10,
        period: new Date().toISOString().slice(0, 10),
      });
    }

    return results.sort((a, b) => b.totalCount - a.totalCount);
  }

  /** DPO 데이터셋 내보내기 — Design §4 */
  exportDPO(): DPOEntry[] {
    return this.comparisons
      .filter((c) => c.preferred !== 'tie')
      .map((c) => ({
        prompt: c.prompt,
        chosen: c.preferred === 'A' ? c.responseA : c.responseB,
        rejected: c.preferred === 'A' ? c.responseB : c.responseA,
      }));
  }

  /** 품질 추이 분석 — Design §5 */
  analyzeQualityTrend(tenantId: string, windowDays = 7): QualityAlert[] {
    const now = Date.now();
    const msPerDay = 86400000;
    const alerts: QualityAlert[] = [];

    // 최근 N일 vs 이전 N일 비교
    const recentEntries = this.entries.filter((e) =>
      e.tenantId === tenantId &&
      Date.parse(e.timestamp) >= now - msPerDay * windowDays,
    );
    const previousEntries = this.entries.filter((e) =>
      e.tenantId === tenantId &&
      Date.parse(e.timestamp) >= now - msPerDay * windowDays * 2 &&
      Date.parse(e.timestamp) < now - msPerDay * windowDays,
    );

    const recentPositive = recentEntries.filter((e) => e.type === 'thumbs' && e.value === 'up').length;
    const recentTotal = recentEntries.filter((e) => e.type === 'thumbs').length;
    const prevPositive = previousEntries.filter((e) => e.type === 'thumbs' && e.value === 'up').length;
    const prevTotal = previousEntries.filter((e) => e.type === 'thumbs').length;

    const recentRate = recentTotal > 0 ? recentPositive / recentTotal : 0;
    const prevRate = prevTotal > 0 ? prevPositive / prevTotal : 0;

    if (prevRate > 0 && recentRate < prevRate) {
      const changePercent = ((recentRate - prevRate) / prevRate) * 100;
      if (changePercent <= -10) {
        alerts.push({
          type: 'decline',
          severity: changePercent <= -20 ? 'critical' : 'warning',
          message: `긍정률 ${Math.abs(Math.round(changePercent))}% 하락 감지 (${Math.round(prevRate * 100)}% -> ${Math.round(recentRate * 100)}%)`,
          currentScore: recentRate,
          previousScore: prevRate,
          changePercent: Math.round(changePercent * 10) / 10,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return alerts;
  }

  /** 피드백 수 */
  get feedbackCount(): number {
    return this.entries.length;
  }

  /** 비교 피드백 수 */
  get comparisonCount(): number {
    return this.comparisons.length;
  }
}
