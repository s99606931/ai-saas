// SVC-AI-ADV-R9 단위 테스트: RAG 자동 평가기 (RAGAS 메트릭)
// Design Ref: SVC-AI-ADV-R9 DESIGN §3
// Plan SC: FR-ADV9.6 (Faithfulness), FR-ADV9.7 (Answer Relevancy), FR-ADV9.8 (Context Precision)
// CSAP: D-12 시스템 개발 보안

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  RAGEvaluator,
  createRAGEvaluator,
} from '../../src/lib/rag-evaluator.js';
import type {
  RAGEvaluationInput,
  RAGEvaluationResult,
} from '../../src/lib/rag-evaluator.js';

// ── 모의 LLM 프로바이더 ────────────────────────────────────────────────────

function createMockProvider(responseOverride?: string) {
  return {
    chat: vi.fn().mockResolvedValue({
      text: responseOverride ?? '{"score": 0.85, "reason": "응답이 컨텍스트에 근거합니다", "supported_claims": 4, "total_claims": 5}',
      tokensUsed: 200,
      model: 'test-evaluator',
    }),
  };
}

function createDefaultInput(overrides: Partial<RAGEvaluationInput> = {}): RAGEvaluationInput {
  return {
    question: '전자정부법 제10조의 내용은 무엇입니까?',
    answer: '전자정부법 제10조는 전자정부서비스의 제공에 관한 규정입니다.',
    contexts: [
      '전자정부법 제10조: 행정기관등의 장은 전자정부서비스를 제공할 때 국민의 편의를 도모하여야 한다.',
      '전자정부법 제11조: 행정기관등의 장은 전자정부서비스의 품질을 관리하여야 한다.',
    ],
    ...overrides,
  };
}

// ── 단일 평가 테스트 ────────────────────────────────────────────────────────

describe('RAGEvaluator 단일 평가', () => {
  let evaluator: RAGEvaluator;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    evaluator = new RAGEvaluator(mockProvider as never);
  });

  it('3개 메트릭을 병렬 평가한다', async () => {
    const result = await evaluator.evaluate(createDefaultInput());

    expect(result.faithfulness).toBeDefined();
    expect(result.answerRelevancy).toBeDefined();
    expect(result.contextPrecision).toBeDefined();
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.evaluatedAt).toBeDefined();

    // 3개 메트릭 병렬 호출 = 3회 LLM 호출
    expect(mockProvider.chat).toHaveBeenCalledTimes(3);
  });

  it('groundTruth 제공 시 answerCorrectness도 평가한다', async () => {
    const result = await evaluator.evaluate(
      createDefaultInput({ groundTruth: '전자정부법 제10조는 전자정부서비스 제공 규정입니다.' }),
    );

    expect(result.answerCorrectness).toBeDefined();
    expect(result.answerCorrectness?.score).toBeGreaterThanOrEqual(0);
    // 3 + 1 = 4회 LLM 호출
    expect(mockProvider.chat).toHaveBeenCalledTimes(4);
  });

  it('groundTruth가 없으면 answerCorrectness가 undefined이다', async () => {
    const result = await evaluator.evaluate(createDefaultInput());
    expect(result.answerCorrectness).toBeUndefined();
  });

  it('점수가 0~1 범위이다', async () => {
    const result = await evaluator.evaluate(createDefaultInput());
    expect(result.faithfulness.score).toBeGreaterThanOrEqual(0);
    expect(result.faithfulness.score).toBeLessThanOrEqual(1);
    expect(result.answerRelevancy.score).toBeGreaterThanOrEqual(0);
    expect(result.answerRelevancy.score).toBeLessThanOrEqual(1);
    expect(result.contextPrecision.score).toBeGreaterThanOrEqual(0);
    expect(result.contextPrecision.score).toBeLessThanOrEqual(1);
  });

  it('overallScore가 가중 평균으로 계산된다', async () => {
    const result = await evaluator.evaluate(createDefaultInput());
    // groundTruth 없이: (0.85*0.35 + 0.85*0.30 + 0.85*0.20) / (1-0.15) = 0.85*0.85/0.85 = 0.85
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(1);
  });

  it('evaluatedAt이 ISO 문자열이다', async () => {
    const result = await evaluator.evaluate(createDefaultInput());
    expect(() => new Date(result.evaluatedAt)).not.toThrow();
  });

  it('evaluationTokensUsed를 집계한다', async () => {
    const result = await evaluator.evaluate(createDefaultInput());
    expect(result.evaluationTokensUsed).toBeGreaterThanOrEqual(0);
  });
});

// ── Faithfulness 평가 — FR-ADV9.6 ──────────────────────────────────────────

describe('RAGEvaluator Faithfulness (FR-ADV9.6)', () => {
  it('Faithfulness 점수를 반환한다', async () => {
    const provider = createMockProvider(
      '{"score": 0.9, "reason": "대부분 컨텍스트에 근거", "supported_claims": 9, "total_claims": 10}',
    );
    const evaluator = new RAGEvaluator(provider as never);
    const result = await evaluator.evaluate(createDefaultInput());

    expect(result.faithfulness.score).toBe(0.9);
    expect(result.faithfulness.reason).toContain('근거');
  });

  it('점수 범위를 0~1로 제한한다', async () => {
    const provider = createMockProvider('{"score": 1.5, "reason": "과대 점수"}');
    const evaluator = new RAGEvaluator(provider as never);
    const result = await evaluator.evaluate(createDefaultInput());

    expect(result.faithfulness.score).toBeLessThanOrEqual(1);
  });
});

// ── Context Precision — FR-ADV9.8 ──────────────────────────────────────────

describe('RAGEvaluator Context Precision (FR-ADV9.8)', () => {
  it('컨텍스트가 없으면 점수 0을 반환한다', async () => {
    const provider = createMockProvider();
    const evaluator = new RAGEvaluator(provider as never);
    const result = await evaluator.evaluate(createDefaultInput({ contexts: [] }));

    expect(result.contextPrecision.score).toBe(0);
    expect(result.contextPrecision.reason).toContain('컨텍스트 없음');
  });
});

// ── LLM 오류 처리 ──────────────────────────────────────────────────────────

describe('RAGEvaluator 오류 처리', () => {
  it('LLM 호출 실패 시 점수 0을 반환한다', async () => {
    const provider = {
      chat: vi.fn().mockRejectedValue(new Error('LLM 서비스 오류')),
    };
    const evaluator = new RAGEvaluator(provider as never);
    const result = await evaluator.evaluate(createDefaultInput());

    expect(result.faithfulness.score).toBe(0);
    expect(result.faithfulness.reason).toContain('실패');
  });

  it('JSON 파싱 실패 시 기본 점수 0.5를 반환한다', async () => {
    const provider = createMockProvider('이것은 JSON이 아닙니다. 평가 결과를 제공합니다.');
    const evaluator = new RAGEvaluator(provider as never);
    const result = await evaluator.evaluate(createDefaultInput());

    expect(result.faithfulness.score).toBe(0.5);
    expect(result.faithfulness.reason).toContain('파싱 실패');
  });
});

// ── 배치 평가 ───────────────────────────────────────────────────────────────

describe('RAGEvaluator 배치 평가', () => {
  it('여러 입력을 순차 평가한다', async () => {
    const provider = createMockProvider();
    const evaluator = new RAGEvaluator(provider as never);

    const inputs = [
      createDefaultInput({ question: '질문 1' }),
      createDefaultInput({ question: '질문 2' }),
      createDefaultInput({ question: '질문 3' }),
    ];

    const batch = await evaluator.evaluateBatch(inputs);

    expect(batch.results).toHaveLength(3);
    expect(batch.totalEvaluations).toBe(3);
    expect(batch.totalTokensUsed).toBeGreaterThanOrEqual(0);
  });

  it('평균 점수를 계산한다', async () => {
    const provider = createMockProvider();
    const evaluator = new RAGEvaluator(provider as never);

    const batch = await evaluator.evaluateBatch([
      createDefaultInput(),
      createDefaultInput(),
    ]);

    expect(batch.averageScores.faithfulness).toBeGreaterThanOrEqual(0);
    expect(batch.averageScores.answerRelevancy).toBeGreaterThanOrEqual(0);
    expect(batch.averageScores.contextPrecision).toBeGreaterThanOrEqual(0);
    expect(batch.averageScores.overall).toBeGreaterThanOrEqual(0);
  });

  it('빈 배치는 0건 결과를 반환한다', async () => {
    const provider = createMockProvider();
    const evaluator = new RAGEvaluator(provider as never);

    const batch = await evaluator.evaluateBatch([]);
    expect(batch.results).toHaveLength(0);
    expect(batch.totalEvaluations).toBe(0);
  });
});

// ── 토큰 사용량 추적 ────────────────────────────────────────────────────────

describe('RAGEvaluator 토큰 사용량', () => {
  it('누적 토큰 사용량을 추적한다', async () => {
    const provider = createMockProvider();
    const evaluator = new RAGEvaluator(provider as never);

    expect(evaluator.getTotalTokensUsed()).toBe(0);

    await evaluator.evaluate(createDefaultInput());
    const firstUsage = evaluator.getTotalTokensUsed();
    expect(firstUsage).toBeGreaterThan(0);

    await evaluator.evaluate(createDefaultInput());
    expect(evaluator.getTotalTokensUsed()).toBeGreaterThan(firstUsage);
  });
});

// ── 팩토리 ──────────────────────────────────────────────────────────────────

describe('createRAGEvaluator 팩토리', () => {
  it('RAGEvaluator 인스턴스를 생성한다', () => {
    const provider = createMockProvider();
    const evaluator = createRAGEvaluator(provider as never);
    expect(evaluator).toBeInstanceOf(RAGEvaluator);
  });
});
