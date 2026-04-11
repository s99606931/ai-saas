// RAG 자동 평가기 (RAGAS 메트릭) — FR-ADV9.6, FR-ADV9.7, FR-ADV9.8
// Design Ref: SVC-AI-ADV-R9 DESIGN §3
// Plan SC: SC-3 (Faithfulness, Answer Relevancy, Context Precision)
// CSAP: D-12 시스템 개발 보안
// N2SF: N-05 O등급 데이터만 평가

import type { LLMProvider, LLMMessage } from './llm-provider.js';

// ── 평가 타입 ────────────────────────────────────────────────────────────────

/** RAG 평가 입력 — Design §3.2 */
export interface RAGEvaluationInput {
  /** 원본 질문 */
  question: string;
  /** LLM 응답 */
  answer: string;
  /** 검색된 컨텍스트 청크 */
  contexts: string[];
  /** 정답 (선택, 있으면 Correctness도 평가) */
  groundTruth?: string;
}

/** 개별 메트릭 결과 */
export interface MetricResult {
  /** 점수 (0.0 ~ 1.0) */
  score: number;
  /** 판정 근거 */
  reason: string;
  /** 세부 사항 */
  details?: Record<string, unknown>;
}

/** 전체 평가 결과 */
export interface RAGEvaluationResult {
  /** Faithfulness: 응답이 컨텍스트에 근거하는 정도 */
  faithfulness: MetricResult;
  /** Answer Relevancy: 응답이 질문에 적절한 정도 */
  answerRelevancy: MetricResult;
  /** Context Precision: 검색된 컨텍스트의 유용성 */
  contextPrecision: MetricResult;
  /** Answer Correctness: 정답 대비 정확도 (groundTruth 제공 시) */
  answerCorrectness?: MetricResult;
  /** 종합 점수 (가중 평균) */
  overallScore: number;
  /** 평가 시각 */
  evaluatedAt: string;
  /** 평가에 사용된 토큰 수 */
  evaluationTokensUsed: number;
}

/** 배치 평가 결과 */
export interface BatchEvaluationResult {
  results: RAGEvaluationResult[];
  averageScores: {
    faithfulness: number;
    answerRelevancy: number;
    contextPrecision: number;
    answerCorrectness: number;
    overall: number;
  };
  totalEvaluations: number;
  totalTokensUsed: number;
}

// ── RAG 평가기 ───────────────────────────────────────────────────────────────

/**
 * RAG 자동 평가기 (RAGAS 메트릭 기반)
 *
 * LLM을 사용하여 RAG 시스템의 응답 품질을 자동 평가합니다.
 *
 * 평가 메트릭:
 * - Faithfulness: 응답이 제공된 컨텍스트에 근거하는지 (환각 방지)
 * - Answer Relevancy: 응답이 원래 질문에 적절한지
 * - Context Precision: 검색된 컨텍스트 중 실제 유용한 비율
 * - Answer Correctness: 정답 대비 정확도 (선택)
 */
export class RAGEvaluator {
  private readonly provider: LLMProvider;
  private totalTokensUsed = 0;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  /**
   * 단일 RAG 응답을 평가합니다
   */
  async evaluate(input: RAGEvaluationInput): Promise<RAGEvaluationResult> {
    let tokensUsed = 0;

    // 병렬 평가 실행
    const [faithfulness, answerRelevancy, contextPrecision] = await Promise.all([
      this.evaluateFaithfulness(input),
      this.evaluateAnswerRelevancy(input),
      this.evaluateContextPrecision(input),
    ]);

    tokensUsed += (faithfulness.details?.['tokensUsed'] as number) ?? 0;
    tokensUsed += (answerRelevancy.details?.['tokensUsed'] as number) ?? 0;
    tokensUsed += (contextPrecision.details?.['tokensUsed'] as number) ?? 0;

    // 정답 대비 정확도 (선택)
    let answerCorrectness: MetricResult | undefined;
    if (input.groundTruth) {
      answerCorrectness = await this.evaluateCorrectness(input);
      tokensUsed += (answerCorrectness.details?.['tokensUsed'] as number) ?? 0;
    }

    this.totalTokensUsed += tokensUsed;

    // 종합 점수 (가중 평균)
    const weights = { faithfulness: 0.35, relevancy: 0.30, precision: 0.20, correctness: 0.15 };
    let overallScore = faithfulness.score * weights.faithfulness +
                       answerRelevancy.score * weights.relevancy +
                       contextPrecision.score * weights.precision;

    if (answerCorrectness) {
      overallScore += answerCorrectness.score * weights.correctness;
    } else {
      // 정답 없으면 나머지 가중치 재분배
      overallScore = overallScore / (1 - weights.correctness);
    }

    return {
      faithfulness,
      answerRelevancy,
      contextPrecision,
      answerCorrectness,
      overallScore: Math.round(overallScore * 100) / 100,
      evaluatedAt: new Date().toISOString(),
      evaluationTokensUsed: tokensUsed,
    };
  }

  /**
   * 배치 평가 (여러 응답을 한꺼번에)
   */
  async evaluateBatch(inputs: RAGEvaluationInput[]): Promise<BatchEvaluationResult> {
    const results: RAGEvaluationResult[] = [];
    let totalTokens = 0;

    // 순차 실행 (LLM 과부하 방지)
    for (const input of inputs) {
      const result = await this.evaluate(input);
      results.push(result);
      totalTokens += result.evaluationTokensUsed;
    }

    // 평균 점수 계산
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    return {
      results,
      averageScores: {
        faithfulness: Math.round(avg(results.map((r) => r.faithfulness.score)) * 100) / 100,
        answerRelevancy: Math.round(avg(results.map((r) => r.answerRelevancy.score)) * 100) / 100,
        contextPrecision: Math.round(avg(results.map((r) => r.contextPrecision.score)) * 100) / 100,
        answerCorrectness: Math.round(avg(results.filter((r) => r.answerCorrectness).map((r) => r.answerCorrectness!.score)) * 100) / 100,
        overall: Math.round(avg(results.map((r) => r.overallScore)) * 100) / 100,
      },
      totalEvaluations: results.length,
      totalTokensUsed: totalTokens,
    };
  }

  /** 총 평가 토큰 사용량 */
  getTotalTokensUsed(): number {
    return this.totalTokensUsed;
  }

  // ── Faithfulness 평가 — FR-ADV9.6 ─────────────────────────────────

  /**
   * 응답의 각 주장이 제공된 컨텍스트에서 지지되는지 평가합니다
   */
  private async evaluateFaithfulness(input: RAGEvaluationInput): Promise<MetricResult> {
    const contextText = input.contexts.map((c, i) => `[컨텍스트 ${i + 1}] ${c}`).join('\n\n');

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 RAG 시스템의 응답 품질을 평가하는 전문가입니다.
응답의 각 주장이 제공된 컨텍스트에서 지지되는지 평가하십시오.
컨텍스트에 근거하지 않는 주장은 환각(hallucination)입니다.

반드시 다음 JSON 형식으로만 응답하십시오:
{"score": 0.0~1.0, "reason": "판정 근거", "supported_claims": N, "total_claims": N}`,
      },
      {
        role: 'user',
        content: `질문: ${input.question}\n\n컨텍스트:\n${contextText}\n\n응답: ${input.answer}\n\n위 응답의 Faithfulness를 평가하십시오.`,
      },
    ];

    return this.callLLMForEvaluation(messages, 'faithfulness');
  }

  // ── Answer Relevancy 평가 — FR-ADV9.7 ─────────────────────────────

  /**
   * 응답이 원래 질문에 적절한지 평가합니다
   */
  private async evaluateAnswerRelevancy(input: RAGEvaluationInput): Promise<MetricResult> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 RAG 시스템의 응답 품질을 평가하는 전문가입니다.
응답이 원래 질문에 적절하고 유용한지 평가하십시오.
- 질문에 직접적으로 답하는가?
- 불필요한 정보가 포함되어 있는가?
- 완전한 답변인가?

반드시 다음 JSON 형식으로만 응답하십시오:
{"score": 0.0~1.0, "reason": "판정 근거"}`,
      },
      {
        role: 'user',
        content: `질문: ${input.question}\n\n응답: ${input.answer}\n\n위 응답의 Answer Relevancy를 평가하십시오.`,
      },
    ];

    return this.callLLMForEvaluation(messages, 'answerRelevancy');
  }

  // ── Context Precision 평가 — FR-ADV9.8 ────────────────────────────

  /**
   * 검색된 컨텍스트 중 실제 유용한 비율을 평가합니다
   */
  private async evaluateContextPrecision(input: RAGEvaluationInput): Promise<MetricResult> {
    if (input.contexts.length === 0) {
      return { score: 0, reason: '컨텍스트 없음' };
    }

    const contextList = input.contexts.map((c, i) =>
      `[컨텍스트 ${i + 1}] ${c}`,
    ).join('\n\n');

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 RAG 시스템의 검색 품질을 평가하는 전문가입니다.
검색된 각 컨텍스트가 질문에 답하는 데 실제로 유용한지 평가하십시오.

반드시 다음 JSON 형식으로만 응답하십시오:
{"score": 0.0~1.0, "reason": "판정 근거", "useful_contexts": N, "total_contexts": N}`,
      },
      {
        role: 'user',
        content: `질문: ${input.question}\n\n검색된 컨텍스트:\n${contextList}\n\n위 컨텍스트의 Context Precision을 평가하십시오.`,
      },
    ];

    return this.callLLMForEvaluation(messages, 'contextPrecision');
  }

  // ── Answer Correctness 평가 ────────────────────────────────────────

  /**
   * 정답 대비 응답의 정확도를 평가합니다
   */
  private async evaluateCorrectness(input: RAGEvaluationInput): Promise<MetricResult> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 RAG 시스템의 응답 정확도를 평가하는 전문가입니다.
정답과 비교하여 응답의 정확도를 평가하십시오.

반드시 다음 JSON 형식으로만 응답하십시오:
{"score": 0.0~1.0, "reason": "판정 근거"}`,
      },
      {
        role: 'user',
        content: `질문: ${input.question}\n\n정답: ${input.groundTruth}\n\n응답: ${input.answer}\n\n위 응답의 정확도를 평가하십시오.`,
      },
    ];

    return this.callLLMForEvaluation(messages, 'correctness');
  }

  // ── LLM 호출 공통 ─────────────────────────────────────────────────

  private async callLLMForEvaluation(messages: LLMMessage[], metricName: string): Promise<MetricResult> {
    try {
      const response = await this.provider.chat(messages, { maxTokens: 500, temperature: 0.1 });

      // JSON 파싱 시도
      const jsonMatch = /\{[\s\S]*\}/.exec(response.text);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        return {
          score: Math.max(0, Math.min(1, Number(parsed['score']) || 0)),
          reason: String(parsed['reason'] ?? ''),
          details: { ...parsed, tokensUsed: response.tokensUsed },
        };
      }

      // JSON 파싱 실패 — 키워드 기반 점수 추정
      return {
        score: 0.5,
        reason: `${metricName} 평가 완료 (구조화 응답 파싱 실패)`,
        details: { rawResponse: response.text, tokensUsed: response.tokensUsed },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '평가 LLM 호출 실패';
      return {
        score: 0,
        reason: `${metricName} 평가 실패: ${message}`,
        details: { error: message, tokensUsed: 0 },
      };
    }
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

/**
 * RAG 평가기 인스턴스 생성
 *
 * @param provider - 평가에 사용할 LLM 프로바이더 (비용 최적화 시 Haiku 권장)
 */
export function createRAGEvaluator(provider: LLMProvider): RAGEvaluator {
  return new RAGEvaluator(provider);
}
