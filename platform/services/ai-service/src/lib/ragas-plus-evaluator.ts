// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R87.design.md
// Plan SC: FR-R87.1~5 (SVC-AI-ADV-R87 RAGAS++ Evaluator)
// CSAP: D-06 감사
//
// 경량 휴리스틱 RAG 평가 + 골든셋 관리 + 회귀 탐지.
// 기존 rag-evaluator.ts는 LLM 기반, 본 모듈은 CI용 no-LLM.

export interface GoldenItem {
  id: string;
  question: string;
  groundTruth: string;
  contexts: string[];
}

export interface RagaScore {
  contextPrecision: number;
  contextRecall: number;
  faithfulness: number;
  answerRelevancy: number;
  overall: number;
}

export interface EvalInput {
  question: string;
  answer: string;
  contexts: string[];
  groundTruth?: string;
}

export interface BatchReport {
  n: number;
  avg: RagaScore;
  perItem: Array<{ id?: string; score: RagaScore }>;
}

export interface RegressionReport {
  regressed: boolean;
  baseline: RagaScore;
  current: RagaScore;
  delta: RagaScore;
}

export interface AuditEvent {
  ts: string;
  action: 'ADD' | 'EVAL' | 'BATCH' | 'REGRESSION' | 'BASELINE_SET';
  details: Record<string, unknown>;
}

const DEFAULT_REGRESSION_THRESHOLD = 0.05;

export class RagasPlusEvaluator {
  private readonly golden = new Map<string, GoldenItem>();
  private baseline: RagaScore | null = null;
  private readonly auditLog: AuditEvent[] = [];
  private readonly regressionThreshold: number;

  constructor(regressionThreshold: number = DEFAULT_REGRESSION_THRESHOLD) {
    this.regressionThreshold = regressionThreshold;
  }

  /** FR-R87.1 */
  addGolden(item: GoldenItem): void {
    if (!item.id || !item.question || !Array.isArray(item.contexts)) {
      throw new Error('invalid golden item');
    }
    this.golden.set(item.id, { ...item, contexts: [...item.contexts] });
    this.log('ADD', { id: item.id });
  }

  /** FR-R87.2 */
  evaluate(input: EvalInput): RagaScore {
    const qTokens = tokenize(input.question);
    const aTokens = tokenize(input.answer);
    const ctxTokens = input.contexts.map(tokenize);
    const flatCtx = new Set(ctxTokens.flat());

    // Context Precision: question 토큰과 겹치는 청크 비율
    const precision =
      ctxTokens.length === 0
        ? 0
        : ctxTokens.filter((c) => qTokens.some((t) => c.includes(t))).length /
          ctxTokens.length;

    // Context Recall: groundTruth 토큰이 contexts에 있는 비율
    let recall = 1;
    if (input.groundTruth) {
      const gtTokens = tokenize(input.groundTruth);
      if (gtTokens.length > 0) {
        const hit = gtTokens.filter((t) => flatCtx.has(t)).length;
        recall = hit / gtTokens.length;
      }
    }

    // Faithfulness: answer 토큰이 contexts에 얼마나 있는지
    const faithfulness =
      aTokens.length === 0
        ? 0
        : aTokens.filter((t) => flatCtx.has(t)).length / aTokens.length;

    // Answer Relevancy: answer-question Jaccard
    const answerRelevancy = jaccard(new Set(aTokens), new Set(qTokens));

    const overall =
      (precision + recall + faithfulness + answerRelevancy) / 4;

    const score: RagaScore = {
      contextPrecision: round(precision),
      contextRecall: round(recall),
      faithfulness: round(faithfulness),
      answerRelevancy: round(answerRelevancy),
      overall: round(overall),
    };

    this.log('EVAL', { overall: score.overall });
    return score;
  }

  /** FR-R87.3 */
  evaluateBatch(
    items: Array<{ id?: string; input: EvalInput }>,
  ): BatchReport {
    if (items.length === 0) {
      return {
        n: 0,
        avg: zeroScore(),
        perItem: [],
      };
    }
    const perItem = items.map((it) => ({
      id: it.id,
      score: this.evaluate(it.input),
    }));
    const sums = perItem.reduce(
      (acc, cur) => ({
        contextPrecision: acc.contextPrecision + cur.score.contextPrecision,
        contextRecall: acc.contextRecall + cur.score.contextRecall,
        faithfulness: acc.faithfulness + cur.score.faithfulness,
        answerRelevancy: acc.answerRelevancy + cur.score.answerRelevancy,
        overall: acc.overall + cur.score.overall,
      }),
      zeroScore(),
    );
    const n = perItem.length;
    const avg: RagaScore = {
      contextPrecision: round(sums.contextPrecision / n),
      contextRecall: round(sums.contextRecall / n),
      faithfulness: round(sums.faithfulness / n),
      answerRelevancy: round(sums.answerRelevancy / n),
      overall: round(sums.overall / n),
    };
    this.log('BATCH', { n, overall: avg.overall });
    return { n, avg, perItem };
  }

  /** FR-R87.4 */
  setBaseline(score: RagaScore): void {
    this.baseline = { ...score };
    this.log('BASELINE_SET', { overall: score.overall });
  }

  checkRegression(current: RagaScore): RegressionReport {
    if (!this.baseline) {
      return {
        regressed: false,
        baseline: zeroScore(),
        current,
        delta: zeroScore(),
      };
    }
    const delta: RagaScore = {
      contextPrecision: round(current.contextPrecision - this.baseline.contextPrecision),
      contextRecall: round(current.contextRecall - this.baseline.contextRecall),
      faithfulness: round(current.faithfulness - this.baseline.faithfulness),
      answerRelevancy: round(current.answerRelevancy - this.baseline.answerRelevancy),
      overall: round(current.overall - this.baseline.overall),
    };
    const regressed = delta.overall < -this.regressionThreshold;
    if (regressed) {
      this.log('REGRESSION', { delta: delta.overall });
    }
    return { regressed, baseline: this.baseline, current, delta };
  }

  /** FR-R87.5 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  getGoldenItems(): readonly GoldenItem[] {
    return Array.from(this.golden.values());
  }

  private log(action: AuditEvent['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ ts: new Date().toISOString(), action, details });
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^0-9a-z\uAC00-\uD7A3]+/)
    .filter((w) => w.length >= 2);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function zeroScore(): RagaScore {
  return {
    contextPrecision: 0,
    contextRecall: 0,
    faithfulness: 0,
    answerRelevancy: 0,
    overall: 0,
  };
}

export function createRagasPlusEvaluator(threshold?: number): RagasPlusEvaluator {
  return new RagasPlusEvaluator(threshold);
}
