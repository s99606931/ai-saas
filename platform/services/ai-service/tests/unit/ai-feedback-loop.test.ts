// SVC-AI-ADV-R19 단위 테스트: AI 피드백 루프
// Design Ref: SVC-AI-ADV-R19 DESIGN §1~§5
// Plan SC: FR-ADV19.1~19.6
// CSAP: D-09 피드백 암호화, D-06 감사 로깅
// N2SF: N-05 PII 마스킹 후 저장

import { describe, it, expect, vi, beforeEach } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  FeedbackStore,
  feedbackSchema,
  comparisonSchema,
} from '../../src/lib/ai-feedback-loop.js';
import type {
  FeedbackEntry,
  ComparisonFeedback,
  DPOEntry,
  FeedbackAggregation,
} from '../../src/lib/ai-feedback-loop.js';

// ── feedbackSchema 입력 검증 ───────────────────────────────────────────────

describe('feedbackSchema 입력 검증 (CSAP D-12)', () => {
  it('유효한 thumbs 피드백을 허용한다', () => {
    const data = {
      responseId: 'resp-1',
      type: 'thumbs' as const,
      value: 'up',
      query: '질문입니다',
      response: '응답입니다',
      model: 'test-model',
    };
    const result = feedbackSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('유효한 rating 피드백을 허용한다', () => {
    const data = {
      responseId: 'resp-2',
      type: 'rating' as const,
      value: 4,
      query: '평가 질문',
      response: '평가 응답',
      model: 'test-model',
    };
    const result = feedbackSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('유효한 text 피드백을 허용한다', () => {
    const data = {
      responseId: 'resp-3',
      type: 'text' as const,
      value: '좋은 답변이었습니다',
      query: '텍스트 질문',
      response: '텍스트 응답',
      model: 'test-model',
    };
    const result = feedbackSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('빈 responseId를 거부한다', () => {
    const data = {
      responseId: '',
      type: 'thumbs' as const,
      value: 'up',
      query: '질문',
      response: '응답',
      model: 'model',
    };
    const result = feedbackSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('잘못된 type을 거부한다', () => {
    const data = {
      responseId: 'resp-1',
      type: 'invalid',
      value: 'up',
      query: '질문',
      response: '응답',
      model: 'model',
    };
    const result = feedbackSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rating 범위를 검증한다 (1~5)', () => {
    const data = {
      responseId: 'resp-1',
      type: 'rating' as const,
      value: 6,
      query: '질문',
      response: '응답',
      model: 'model',
    };
    const result = feedbackSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ── comparisonSchema 입력 검증 ─────────────────────────────────────────────

describe('comparisonSchema 입력 검증', () => {
  it('유효한 비교 피드백을 허용한다', () => {
    const data = {
      prompt: '테스트 질문',
      responseA: '응답 A',
      responseB: '응답 B',
      preferred: 'A' as const,
      modelA: 'model-a',
      modelB: 'model-b',
    };
    const result = comparisonSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('tie 선호도를 허용한다', () => {
    const data = {
      prompt: '테스트',
      responseA: 'A',
      responseB: 'B',
      preferred: 'tie' as const,
      modelA: 'a',
      modelB: 'b',
    };
    const result = comparisonSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('잘못된 preferred를 거부한다', () => {
    const data = {
      prompt: '테스트',
      responseA: 'A',
      responseB: 'B',
      preferred: 'C',
      modelA: 'a',
      modelB: 'b',
    };
    const result = comparisonSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ── FeedbackStore — Design §1 피드백 수집 ──────────────────────────────────

describe('FeedbackStore 피드백 수집 (FR-ADV19.1)', () => {
  let store: FeedbackStore;

  beforeEach(() => {
    store = new FeedbackStore();
  });

  it('피드백을 추가한다', () => {
    const entry = store.addFeedback('user-1', 'tenant-1', {
      responseId: 'resp-1',
      type: 'thumbs',
      value: 'up',
      query: '테스트 질문',
      response: '테스트 응답',
      model: 'test-model',
    });

    expect(entry.id).toMatch(/^fb-/);
    expect(entry.userId).toBe('user-1');
    expect(entry.tenantId).toBe('tenant-1');
    expect(entry.type).toBe('thumbs');
    expect(entry.value).toBe('up');
    expect(entry.timestamp).toBeDefined();
    expect(store.feedbackCount).toBe(1);
  });

  it('PII를 마스킹한다 (N2SF N-05)', () => {
    const entry = store.addFeedback('user-1', 'tenant-1', {
      responseId: 'resp-1',
      type: 'text',
      value: '주민번호 900101-1234567 관련 답변',
      query: '주민번호 900101-1234567 조회',
      response: '결과: 900101-1234567',
      model: 'model',
    });

    expect(entry.query).not.toContain('900101-1234567');
    expect(entry.response).not.toContain('900101-1234567');
  });

  it('여러 피드백을 누적한다', () => {
    for (let i = 0; i < 5; i++) {
      store.addFeedback('user-1', 'tenant-1', {
        responseId: `resp-${i}`,
        type: 'thumbs',
        value: i % 2 === 0 ? 'up' : 'down',
        query: '질문',
        response: '응답',
        model: 'model',
      });
    }
    expect(store.feedbackCount).toBe(5);
  });

  it('promptVersion을 포함할 수 있다', () => {
    const entry = store.addFeedback('user-1', 'tenant-1', {
      responseId: 'resp-1',
      type: 'rating',
      value: 5,
      query: '질문',
      response: '응답',
      model: 'model',
      promptVersion: 'v2.0',
    });
    expect(entry.promptVersion).toBe('v2.0');
  });
});

// ── FeedbackStore — Design §2 비교 피드백 ──────────────────────────────────

describe('FeedbackStore 비교 피드백 (FR-ADV19.2)', () => {
  let store: FeedbackStore;

  beforeEach(() => {
    store = new FeedbackStore();
  });

  it('비교 피드백을 추가한다', () => {
    const comparison = store.addComparison('user-1', 'tenant-1', {
      prompt: '테스트 질문',
      responseA: '응답 A',
      responseB: '응답 B',
      preferred: 'A',
      modelA: 'model-a',
      modelB: 'model-b',
    });

    expect(comparison.id).toMatch(/^cmp-/);
    expect(comparison.preferred).toBe('A');
    expect(store.comparisonCount).toBe(1);
  });

  it('reason을 선택적으로 포함한다', () => {
    const comparison = store.addComparison('user-1', 'tenant-1', {
      prompt: '질문',
      responseA: 'A',
      responseB: 'B',
      preferred: 'B',
      reason: '응답 B가 더 정확합니다',
      modelA: 'a',
      modelB: 'b',
    });
    expect(comparison.reason).toContain('정확');
  });

  it('비교 피드백도 PII를 마스킹한다', () => {
    const comparison = store.addComparison('user-1', 'tenant-1', {
      prompt: '주민번호 900101-1234567',
      responseA: '결과 A: 900101-1234567',
      responseB: '결과 B',
      preferred: 'A',
      modelA: 'a',
      modelB: 'b',
    });
    expect(comparison.prompt).not.toContain('900101-1234567');
    expect(comparison.responseA).not.toContain('900101-1234567');
  });
});

// ── FeedbackStore — Design §3 집계 ─────────────────────────────────────────

describe('FeedbackStore 집계 (FR-ADV19.3)', () => {
  let store: FeedbackStore;

  beforeEach(() => {
    store = new FeedbackStore();
    // 모델별 피드백 추가
    for (let i = 0; i < 6; i++) {
      store.addFeedback('user-1', 'tenant-1', {
        responseId: `resp-${i}`,
        type: 'thumbs',
        value: i < 4 ? 'up' : 'down',
        query: '질문',
        response: '응답',
        model: i < 3 ? 'model-a' : 'model-b',
      });
    }
    // rating 피드백 추가
    store.addFeedback('user-1', 'tenant-1', {
      responseId: 'resp-r1',
      type: 'rating',
      value: 5,
      query: '질문',
      response: '응답',
      model: 'model-a',
    });
    store.addFeedback('user-1', 'tenant-1', {
      responseId: 'resp-r2',
      type: 'rating',
      value: 2,
      query: '질문',
      response: '응답',
      model: 'model-b',
    });
  });

  it('모델별로 집계한다', () => {
    const agg = store.aggregate('model', 'tenant-1');
    expect(agg.length).toBe(2);
    const modelA = agg.find((a) => a.key === 'model-a');
    expect(modelA).toBeDefined();
    expect(modelA!.totalCount).toBeGreaterThan(0);
  });

  it('thumbsUp/thumbsDown을 계산한다', () => {
    const agg = store.aggregate('model', 'tenant-1');
    const modelA = agg.find((a) => a.key === 'model-a');
    expect(modelA!.thumbsUp).toBeGreaterThan(0);
  });

  it('평균 별점을 계산한다', () => {
    const agg = store.aggregate('model', 'tenant-1');
    const modelA = agg.find((a) => a.key === 'model-a');
    expect(modelA!.avgRating).toBe(5);
  });

  it('긍정률을 계산한다', () => {
    const agg = store.aggregate('model', 'tenant-1');
    const modelA = agg.find((a) => a.key === 'model-a');
    // model-a: 3 thumbs up, 0 thumbs down -> positiveRate = 1.0
    expect(modelA!.positiveRate).toBe(1);
  });

  it('NPS를 계산한다', () => {
    const agg = store.aggregate('model', 'tenant-1');
    const modelA = agg.find((a) => a.key === 'model-a');
    // model-a: rating 5 -> promoter 1, detractor 0 -> NPS = 100
    expect(modelA!.nps).toBe(100);
  });

  it('테넌트 격리가 적용된다 (CSAP D-08)', () => {
    store.addFeedback('user-2', 'tenant-2', {
      responseId: 'resp-other',
      type: 'thumbs',
      value: 'up',
      query: '질문',
      response: '응답',
      model: 'model-a',
    });
    const agg = store.aggregate('model', 'tenant-2');
    const modelA = agg.find((a) => a.key === 'model-a');
    expect(modelA!.totalCount).toBe(1);
  });

  it('빈 테넌트는 빈 배열을 반환한다', () => {
    const agg = store.aggregate('model', 'no-tenant');
    expect(agg).toHaveLength(0);
  });

  it('totalCount 내림차순으로 정렬한다', () => {
    const agg = store.aggregate('model', 'tenant-1');
    for (let i = 1; i < agg.length; i++) {
      expect(agg[i - 1]!.totalCount).toBeGreaterThanOrEqual(agg[i]!.totalCount);
    }
  });
});

// ── FeedbackStore — Design §4 DPO 내보내기 ─────────────────────────────────

describe('FeedbackStore DPO 내보내기 (FR-ADV19.4)', () => {
  let store: FeedbackStore;

  beforeEach(() => {
    store = new FeedbackStore();
  });

  it('비교 피드백에서 DPO 데이터를 내보낸다', () => {
    store.addComparison('user-1', 'tenant-1', {
      prompt: '질문',
      responseA: '좋은 응답',
      responseB: '나쁜 응답',
      preferred: 'A',
      modelA: 'a',
      modelB: 'b',
    });

    const dpo = store.exportDPO();
    expect(dpo).toHaveLength(1);
    expect(dpo[0]!.chosen).toBe('좋은 응답');
    expect(dpo[0]!.rejected).toBe('나쁜 응답');
  });

  it('B 선호 시 chosen/rejected을 올바르게 설정한다', () => {
    store.addComparison('user-1', 'tenant-1', {
      prompt: '질문',
      responseA: 'A 응답',
      responseB: 'B 응답',
      preferred: 'B',
      modelA: 'a',
      modelB: 'b',
    });

    const dpo = store.exportDPO();
    expect(dpo[0]!.chosen).toBe('B 응답');
    expect(dpo[0]!.rejected).toBe('A 응답');
  });

  it('tie는 DPO에서 제외한다', () => {
    store.addComparison('user-1', 'tenant-1', {
      prompt: '질문',
      responseA: 'A',
      responseB: 'B',
      preferred: 'tie',
      modelA: 'a',
      modelB: 'b',
    });

    const dpo = store.exportDPO();
    expect(dpo).toHaveLength(0);
  });

  it('비교 피드백이 없으면 빈 배열을 반환한다', () => {
    const dpo = store.exportDPO();
    expect(dpo).toHaveLength(0);
  });
});

// ── FeedbackStore — Design §5 품질 추이 ────────────────────────────────────

describe('FeedbackStore 품질 추이 (FR-ADV19.5)', () => {
  it('피드백이 없으면 경고 없음', () => {
    const store = new FeedbackStore();
    const alerts = store.analyzeQualityTrend('tenant-1');
    expect(alerts).toHaveLength(0);
  });

  it('긍정률이 안정적이면 경고 없음', () => {
    const store = new FeedbackStore();
    // 최근 7일 피드백
    for (let i = 0; i < 5; i++) {
      store.addFeedback('user-1', 'tenant-1', {
        responseId: `resp-${i}`,
        type: 'thumbs',
        value: 'up',
        query: '질문',
        response: '응답',
        model: 'model',
      });
    }
    const alerts = store.analyzeQualityTrend('tenant-1');
    expect(alerts).toHaveLength(0);
  });
});
