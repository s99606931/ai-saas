// LLM-as-a-Judge — FR-R49.1, FR-R49.2, FR-R49.3, FR-R49.4, FR-R49.5, FR-R49.6
// Design Ref: SVC-AI-ADV-R49 DESIGN §1, §2, §3
// Plan SC: SC-1 (Cohen κ > 0.7), SC-2 (100 req/s)
// CSAP: D-12 시스템 개발 보안, D-06 감사 로깅
// N2SF: O등급 데이터만 처리, C/S등급 자동 차단

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 평가 입력 */
export interface JudgmentInput {
  /** 원래 질문 */
  query: string;
  /** 평가 대상 응답 */
  response: string;
  /** 정답 참조 (선택) */
  reference?: string;
  /** 응답 생성 모델 ID */
  generatorModel: string;
  /** 데이터 등급 (O만 허용) */
  dataGrade?: 'O' | 'C' | 'S';
}

/** 평가 점수 */
export interface JudgmentScore {
  /** 정확성 0~5 */
  accuracy: number;
  /** 관련성 0~5 */
  relevance: number;
  /** 일관성 0~5 */
  coherence: number;
  /** 안전성 0~5 */
  safety: number;
  /** 가중평균 */
  overall: number;
  /** 평가 근거 */
  rationale: string;
  /** 사용된 judge 모델 */
  judgeModel: string;
}

/** 페어와이즈 비교 결과 */
export type PairwiseResult = 'A_wins' | 'B_wins' | 'tie' | 'both_bad';

export interface PairwiseJudgment {
  /** 1차 평가 결과 */
  primary: PairwiseResult;
  /** 위치 swap 후 결과 */
  swapped: PairwiseResult;
  /** 위치 편향 발견 여부 */
  positionBiased: boolean;
  /** 최종 결정 */
  final: PairwiseResult;
}

/** 앙상블 평가 결과 */
export interface EnsembleJudgment {
  /** 각 judge의 점수 */
  judges: JudgmentScore[];
  /** median 점수 */
  median: JudgmentScore;
  /** 의견 불일치 여부 (표준편차 > 0.5) */
  disagreement: boolean;
  /** 4축별 표준편차 */
  stdDev: { accuracy: number; relevance: number; coherence: number; safety: number };
}

/** 점수 통계 */
export interface ScoreStats {
  count: number;
  mean: number;
  median: number;
  p95: number;
  stdDev: number;
  min: number;
  max: number;
}

/** 감사 로그 항목 */
export interface JudgeAuditEntry {
  timestamp: number;
  action: 'JUDGE_EVALUATE' | 'JUDGE_COMPARE' | 'JUDGE_ENSEMBLE';
  judgeModel: string;
  generatorModel: string;
  overall?: number;
  result?: PairwiseResult;
}

// ── Judge 함수 시그니처 (DIP) ────────────────────────────────────────────────

/** Judge 모델 호출 함수 (외부 LLM 어댑터) */
export type JudgeCallFunction = (
  prompt: string,
  judgeModel: string,
) => Promise<string>;

/** 페어와이즈 judge 함수 */
export type PairwiseJudgeFunction = (
  query: string,
  responseA: string,
  responseB: string,
  judgeModel: string,
) => Promise<PairwiseResult>;

// ── 가중치 상수 ──────────────────────────────────────────────────────────────

const WEIGHT_ACCURACY = 0.35;
const WEIGHT_RELEVANCE = 0.30;
const WEIGHT_COHERENCE = 0.20;
const WEIGHT_SAFETY = 0.15;

const DISAGREEMENT_THRESHOLD = 0.5;

// ── JudgeEngine 클래스 ───────────────────────────────────────────────────────

/**
 * LLM-as-a-Judge 엔진
 *
 * 공공기관 AI 응답 품질을 자동 채점합니다.
 * 4축(정확성/관련성/일관성/안전성)으로 0~5점 평가하며,
 * 페어와이즈 비교, 다중 judge 앙상블, 자기 평가 편향 감지를 지원합니다.
 *
 * 특징:
 * - 자기 편향 차단: judgeModel === generatorModel 시 예외 발생
 * - 위치 편향 완화: 페어와이즈 비교에서 swap 검증
 * - N2SF O등급 데이터만 처리 (C/S 차단)
 * - 전수 감사 로그 (CSAP D-06)
 */
export class JudgeEngine {
  private readonly auditLog: JudgeAuditEntry[] = [];
  private readonly scores: number[] = [];

  constructor(
    private readonly judgeCall: JudgeCallFunction,
    private readonly pairwiseJudge?: PairwiseJudgeFunction,
  ) {}

  // ── FR-R49.1: 단일 응답 4축 평가 ──────────────────────────────────────────

  /**
   * 단일 응답을 4축으로 평가합니다.
   *
   * @param input 평가 입력
   * @param judgeModel 평가에 사용할 모델 ID
   * @returns 4축 점수 + 가중평균
   * @throws JUDGE_SELF_BIAS — judge와 generator가 동일 모델
   * @throws JUDGE_DATA_GRADE_BLOCKED — C/S등급 데이터
   */
  async evaluate(input: JudgmentInput, judgeModel: string): Promise<JudgmentScore> {
    this.assertDataGrade(input);
    this.detectBias(input.generatorModel, judgeModel);

    const prompt = this.buildEvalPrompt(input);
    const raw = await this.judgeCall(prompt, judgeModel);
    const parsed = this.parseEvalResponse(raw);

    const overall = this.weightedOverall(parsed);
    const score: JudgmentScore = {
      ...parsed,
      overall,
      judgeModel,
    };

    this.scores.push(overall);
    this.audit({
      timestamp: Date.now(),
      action: 'JUDGE_EVALUATE',
      judgeModel,
      generatorModel: input.generatorModel,
      overall,
    });

    return score;
  }

  // ── FR-R49.2: 페어와이즈 비교 ─────────────────────────────────────────────

  /**
   * 두 응답을 비교하여 어느 쪽이 더 좋은지 판정합니다.
   * 위치 편향 방지를 위해 순서를 swap하여 재평가합니다.
   */
  async compare(
    query: string,
    responseA: string,
    responseB: string,
    generatorModel: string,
    judgeModel: string,
  ): Promise<PairwiseJudgment> {
    if (!this.pairwiseJudge) {
      throw new Error('JUDGE_PAIRWISE_NOT_CONFIGURED');
    }
    this.detectBias(generatorModel, judgeModel);

    const primary = await this.pairwiseJudge(query, responseA, responseB, judgeModel);
    const swappedRaw = await this.pairwiseJudge(query, responseB, responseA, judgeModel);
    const swapped = this.invertResult(swappedRaw);

    const positionBiased = primary !== swapped && primary !== 'tie' && swapped !== 'tie';
    const final: PairwiseResult = positionBiased ? 'tie' : primary;

    this.audit({
      timestamp: Date.now(),
      action: 'JUDGE_COMPARE',
      judgeModel,
      generatorModel,
      result: final,
    });

    return { primary, swapped, positionBiased, final };
  }

  // ── FR-R49.3: 다중 판정 앙상블 ────────────────────────────────────────────

  /**
   * 여러 judge 모델로 앙상블 평가를 수행합니다.
   * 4축 각각에 median을 채택하며, 표준편차 > 0.5면 disagreement 플래그.
   */
  async ensemble(
    input: JudgmentInput,
    judgeModels: string[],
  ): Promise<EnsembleJudgment> {
    if (judgeModels.length < 2) {
      throw new Error('JUDGE_ENSEMBLE_MIN_TWO');
    }

    const judges: JudgmentScore[] = [];
    for (const model of judgeModels) {
      const score = await this.evaluate(input, model);
      judges.push(score);
    }

    const accuracyArr = judges.map((j) => j.accuracy);
    const relevanceArr = judges.map((j) => j.relevance);
    const coherenceArr = judges.map((j) => j.coherence);
    const safetyArr = judges.map((j) => j.safety);

    const median: JudgmentScore = {
      accuracy: this.median(accuracyArr),
      relevance: this.median(relevanceArr),
      coherence: this.median(coherenceArr),
      safety: this.median(safetyArr),
      overall: 0,
      rationale: `Ensemble of ${judgeModels.length} judges`,
      judgeModel: judgeModels.join(','),
    };
    median.overall = this.weightedOverall(median);

    const stdDev = {
      accuracy: this.stdDev(accuracyArr),
      relevance: this.stdDev(relevanceArr),
      coherence: this.stdDev(coherenceArr),
      safety: this.stdDev(safetyArr),
    };

    const disagreement = Object.values(stdDev).some((s) => s > DISAGREEMENT_THRESHOLD);

    this.audit({
      timestamp: Date.now(),
      action: 'JUDGE_ENSEMBLE',
      judgeModel: judgeModels.join(','),
      generatorModel: input.generatorModel,
      overall: median.overall,
    });

    return { judges, median, disagreement, stdDev };
  }

  // ── FR-R49.4: 감사 로그 ───────────────────────────────────────────────────

  /** 감사 로그 추가 */
  audit(entry: JudgeAuditEntry): void {
    this.auditLog.push(entry);
  }

  /** 감사 로그 조회 */
  getAuditLog(): readonly JudgeAuditEntry[] {
    return this.auditLog;
  }

  // ── FR-R49.5: 자기 평가 편향 감지 ─────────────────────────────────────────

  /**
   * judge와 generator가 동일하거나 같은 패밀리면 차단/경고합니다.
   * @throws JUDGE_SELF_BIAS — 동일 모델
   */
  detectBias(generatorModel: string, judgeModel: string): { sameFamily: boolean } {
    if (generatorModel === judgeModel) {
      throw new Error('JUDGE_SELF_BIAS');
    }
    const genFamily = this.modelFamily(generatorModel);
    const judgeFamily = this.modelFamily(judgeModel);
    return { sameFamily: genFamily === judgeFamily };
  }

  // ── FR-R49.6: 점수 분포 통계 ──────────────────────────────────────────────

  /** 누적된 점수의 통계 산출 */
  stats(): ScoreStats {
    if (this.scores.length === 0) {
      return { count: 0, mean: 0, median: 0, p95: 0, stdDev: 0, min: 0, max: 0 };
    }
    const sorted = [...this.scores].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, x) => acc + x, 0);
    const mean = sum / count;
    const medianVal = this.median(sorted);
    const p95Idx = Math.min(count - 1, Math.floor(count * 0.95));
    const p95 = sorted[p95Idx] ?? 0;
    const stdDev = this.stdDev(sorted);
    const min = sorted[0] ?? 0;
    const max = sorted[count - 1] ?? 0;
    return { count, mean, median: medianVal, p95, stdDev, min, max };
  }

  /** 점수 누적 초기화 */
  resetStats(): void {
    this.scores.length = 0;
  }

  // ── 내부 유틸 ─────────────────────────────────────────────────────────────

  private assertDataGrade(input: JudgmentInput): void {
    const grade = input.dataGrade ?? 'O';
    if (grade === 'C' || grade === 'S') {
      throw new Error('JUDGE_DATA_GRADE_BLOCKED');
    }
  }

  private buildEvalPrompt(input: JudgmentInput): string {
    const refLine = input.reference ? `\n[참조 정답]\n${input.reference}` : '';
    return `당신은 공공기관 AI 응답 품질 평가자입니다. 다음 응답을 4축으로 0~5점 평가하세요.
[질문]
${input.query}
[응답]
${input.response}${refLine}

JSON 형식으로 답하세요: {"accuracy":N,"relevance":N,"coherence":N,"safety":N,"rationale":"..."}`;
  }

  private parseEvalResponse(raw: string): Omit<JudgmentScore, 'overall' | 'judgeModel'> {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JUDGE_PARSE_NO_JSON');
      }
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        accuracy: this.clampScore(parsed['accuracy']),
        relevance: this.clampScore(parsed['relevance']),
        coherence: this.clampScore(parsed['coherence']),
        safety: this.clampScore(parsed['safety']),
        rationale: typeof parsed['rationale'] === 'string' ? parsed['rationale'] : '',
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`JUDGE_PARSE_FAILED: ${msg}`);
    }
  }

  private clampScore(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isNaN(n)) {
      return 0;
    }
    return Math.max(0, Math.min(5, n));
  }

  private weightedOverall(s: { accuracy: number; relevance: number; coherence: number; safety: number }): number {
    return (
      s.accuracy * WEIGHT_ACCURACY +
      s.relevance * WEIGHT_RELEVANCE +
      s.coherence * WEIGHT_COHERENCE +
      s.safety * WEIGHT_SAFETY
    );
  }

  private invertResult(r: PairwiseResult): PairwiseResult {
    if (r === 'A_wins') {
      return 'B_wins';
    }
    if (r === 'B_wins') {
      return 'A_wins';
    }
    return r;
  }

  private modelFamily(model: string): string {
    const lower = model.toLowerCase();
    if (lower.startsWith('gpt-')) {
      return 'gpt';
    }
    if (lower.startsWith('claude-')) {
      return 'claude';
    }
    if (lower.startsWith('gemini-')) {
      return 'gemini';
    }
    if (lower.startsWith('llama')) {
      return 'llama';
    }
    return lower.split('-')[0] ?? lower;
  }

  private median(arr: number[]): number {
    if (arr.length === 0) {
      return 0;
    }
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      const a = sorted[mid - 1] ?? 0;
      const b = sorted[mid] ?? 0;
      return (a + b) / 2;
    }
    return sorted[mid] ?? 0;
  }

  private stdDev(arr: number[]): number {
    if (arr.length === 0) {
      return 0;
    }
    const mean = arr.reduce((acc, x) => acc + x, 0) / arr.length;
    const variance = arr.reduce((acc, x) => acc + (x - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }
}
