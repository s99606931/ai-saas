// Eval Harness v2 — FR-R68.1~R68.5
// Design Ref: SVC-AI-ADV-R68 DESIGN §모듈
// Plan SC: 지표 6종, 회귀 판정
// CSAP: D-06 감사
// N2SF: N-05 등급

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';

export interface EvalSample {
  id: string;
  question: string;
  groundTruth: string;
  contexts: string[];
  answer: string;
  grade: DataGrade;
}

export interface EvalDataset {
  id: string;
  name: string;
  samples: EvalSample[];
}

export interface MetricScores {
  faithfulness: number;
  answerRelevance: number;
  contextPrecision: number;
  contextRecall: number;
  similarity: number;
  groundedness: number;
}

export interface RegressionReport {
  baseline: MetricScores;
  deltas: MetricScores;
  regressed: boolean;
  regressedMetrics: string[];
}

export interface BenchReport {
  datasetId: string;
  ranAt: string;
  sampleCount: number;
  aggregate: MetricScores;
  perSample: { id: string; scores: MetricScores }[];
  regression?: RegressionReport;
}

export type EvalAuditAction =
  | 'DATASET_REGISTER'
  | 'BENCH_RUN'
  | 'BASELINE_SET'
  | 'REGRESSION_DETECT'
  | 'GRADE_BLOCK';

export interface EvalAuditEntry {
  timestamp: string;
  action: EvalAuditAction;
  datasetId?: string;
  reason?: string;
}

// ── 토큰 유틸 ─────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.!?;:()\[\]{}"']+/u)
    .filter((t) => t.length > 0);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function containsRatio(needleTokens: string[], haystackTokens: string[]): number {
  if (needleTokens.length === 0) return 1;
  const set = new Set(haystackTokens);
  let hit = 0;
  for (const t of needleTokens) if (set.has(t)) hit += 1;
  return hit / needleTokens.length;
}

// ── 메인 클래스 ──────────────────────────────────────────────────────────────

export class EvalHarnessV2 {
  private readonly datasets = new Map<string, EvalDataset>();
  private readonly baselines = new Map<string, MetricScores>();
  private readonly audit: EvalAuditEntry[] = [];
  private readonly regressionThreshold: number;

  public constructor(opts: { regressionThreshold?: number } = {}) {
    this.regressionThreshold = opts.regressionThreshold ?? 0.05;
  }

  public addDataset(ds: EvalDataset): void {
    for (const s of ds.samples) {
      if (s.grade !== 'O') {
        this.record('GRADE_BLOCK', {
          datasetId: ds.id,
          reason: `sample:${s.id}:${s.grade}`,
        });
        throw new Error('EVAL_GRADE_BLOCKED');
      }
    }
    this.datasets.set(ds.id, ds);
    this.record('DATASET_REGISTER', { datasetId: ds.id });
  }

  public scoreSample(sample: EvalSample): MetricScores {
    const qTok = tokenize(sample.question);
    const aTok = tokenize(sample.answer);
    const gtTok = tokenize(sample.groundTruth);
    const ctxAllTok = sample.contexts.flatMap((c) => tokenize(c));

    const faithfulness = containsRatio(aTok, ctxAllTok);
    const answerRelevance = jaccard(qTok, aTok);
    const contextPrecision =
      sample.contexts.length === 0
        ? 0
        : sample.contexts.filter((c) => {
            const ctok = tokenize(c);
            return qTok.some((q) => ctok.includes(q));
          }).length / sample.contexts.length;
    const contextRecall = containsRatio(gtTok, ctxAllTok);
    const similarity = jaccard(aTok, gtTok);

    const sentences = splitSentences(sample.answer);
    const groundedness =
      sentences.length === 0
        ? 0
        : sentences.filter((s) => {
            const stok = tokenize(s);
            return containsRatio(stok, ctxAllTok) >= 0.5;
          }).length / sentences.length;

    return {
      faithfulness,
      answerRelevance,
      contextPrecision,
      contextRecall,
      similarity,
      groundedness,
    };
  }

  public run(datasetId: string): BenchReport {
    const ds = this.datasets.get(datasetId);
    if (!ds) throw new Error('EVAL_DATASET_NOT_FOUND');
    const perSample = ds.samples.map((s) => ({
      id: s.id,
      scores: this.scoreSample(s),
    }));
    const aggregate = this.aggregate(perSample.map((p) => p.scores));
    const report: BenchReport = {
      datasetId,
      ranAt: new Date().toISOString(),
      sampleCount: ds.samples.length,
      aggregate,
      perSample,
    };

    const baseline = this.baselines.get(datasetId);
    if (baseline) {
      const deltas: MetricScores = {
        faithfulness: aggregate.faithfulness - baseline.faithfulness,
        answerRelevance: aggregate.answerRelevance - baseline.answerRelevance,
        contextPrecision: aggregate.contextPrecision - baseline.contextPrecision,
        contextRecall: aggregate.contextRecall - baseline.contextRecall,
        similarity: aggregate.similarity - baseline.similarity,
        groundedness: aggregate.groundedness - baseline.groundedness,
      };
      const regressedMetrics: string[] = [];
      for (const [k, v] of Object.entries(deltas)) {
        if (v < -this.regressionThreshold) regressedMetrics.push(k);
      }
      const regressed = regressedMetrics.length > 0;
      report.regression = { baseline, deltas, regressed, regressedMetrics };
      if (regressed) {
        this.record('REGRESSION_DETECT', {
          datasetId,
          reason: regressedMetrics.join(','),
        });
      }
    }

    this.record('BENCH_RUN', { datasetId });
    return report;
  }

  public setBaseline(datasetId: string, scores: MetricScores): void {
    this.baselines.set(datasetId, scores);
    this.record('BASELINE_SET', { datasetId });
  }

  public getDatasetCount(): number {
    return this.datasets.size;
  }

  public getAuditLog(): EvalAuditEntry[] {
    return [...this.audit];
  }

  private aggregate(list: MetricScores[]): MetricScores {
    if (list.length === 0) {
      return {
        faithfulness: 0,
        answerRelevance: 0,
        contextPrecision: 0,
        contextRecall: 0,
        similarity: 0,
        groundedness: 0,
      };
    }
    const sum: MetricScores = {
      faithfulness: 0,
      answerRelevance: 0,
      contextPrecision: 0,
      contextRecall: 0,
      similarity: 0,
      groundedness: 0,
    };
    for (const s of list) {
      sum.faithfulness += s.faithfulness;
      sum.answerRelevance += s.answerRelevance;
      sum.contextPrecision += s.contextPrecision;
      sum.contextRecall += s.contextRecall;
      sum.similarity += s.similarity;
      sum.groundedness += s.groundedness;
    }
    const n = list.length;
    return {
      faithfulness: sum.faithfulness / n,
      answerRelevance: sum.answerRelevance / n,
      contextPrecision: sum.contextPrecision / n,
      contextRecall: sum.contextRecall / n,
      similarity: sum.similarity / n,
      groundedness: sum.groundedness / n,
    };
  }

  private record(
    action: EvalAuditAction,
    extra: Partial<EvalAuditEntry> = {},
  ): void {
    this.audit.push({
      timestamp: new Date().toISOString(),
      action,
      ...extra,
    });
  }
}
