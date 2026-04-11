// 프롬프트 A/B 테스트 & 카나리 배포 — FR-ADV18.1~18.6
// Design Ref: SVC-AI-ADV-R18 DESIGN §1~§6
// Plan SC: SC-1 (실험 정의), SC-2 (트래픽 분배), SC-3 (메트릭), SC-4 (통계)
// CSAP: D-12 변경 관리, D-06 감사 로깅
// N2SF: N-05 실험 데이터 O등급

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 실험 상태 — Design §1 */
export type ExperimentStatus = 'draft' | 'running' | 'concluded' | 'archived';

/** 실험 판정 결과 */
export type ExperimentVerdict = 'variant_wins' | 'control_wins' | 'inconclusive';

/** 프롬프트 변형 */
export interface PromptVariant {
  id: string;
  name: string;
  promptTemplate: string;
  trafficPercent: number;
}

/** 실험 정의 — Design §1 */
export interface Experiment {
  id: string;
  name: string;
  description: string;
  control: PromptVariant;
  variants: PromptVariant[];
  status: ExperimentStatus;
  minSampleSize: number;
  confidenceLevel: number;
  startedAt?: string;
  concludedAt?: string;
  verdict?: ExperimentVerdict;
  metadata: Record<string, unknown>;
}

/** 실험 메트릭 수집 항목 — Design §3 */
export interface ExperimentMetric {
  experimentId: string;
  variantId: string;
  userId: string;
  qualityScore: number;
  latencyMs: number;
  tokensUsed: number;
  userFeedback?: 'positive' | 'negative' | null;
  timestamp: string;
}

/** 변형별 집계 통계 */
export interface VariantStats {
  variantId: string;
  sampleSize: number;
  avgQualityScore: number;
  avgLatencyMs: number;
  avgTokensUsed: number;
  positiveRate: number;
  negativeRate: number;
}

/** 통계 분석 결과 — Design §4 */
export interface StatisticalResult {
  zScore: number;
  pValue: number;
  significant: boolean;
  verdict: ExperimentVerdict;
  controlStats: VariantStats;
  variantStats: VariantStats;
  confidenceInterval: { lower: number; upper: number };
}

// ── MurmurHash3 기반 트래픽 분배 — Design §2 ───────────────────────────────

/**
 * MurmurHash3 간이 구현 (32비트)
 * 동일 userId+experimentId → 항상 같은 버킷
 */
function murmurHash3(key: string, seed = 0): number {
  let h = seed;
  for (let i = 0; i < key.length; i++) {
    const k = key.charCodeAt(i);
    h = Math.imul(h ^ k, 0x5bd1e995);
    h ^= h >>> 13;
  }
  h ^= key.length;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * 사용자를 variant에 할당
 * userId + experimentId 해시 기반 일관된 분배
 */
export function assignVariant(
  userId: string,
  experiment: Experiment,
): PromptVariant {
  const hash = murmurHash3(`${userId}:${experiment.id}`);
  const bucket = hash % 100;

  let cumulative = experiment.control.trafficPercent;
  if (bucket < cumulative) {
    return experiment.control;
  }

  for (const variant of experiment.variants) {
    cumulative += variant.trafficPercent;
    if (bucket < cumulative) {
      return variant;
    }
  }

  // 폴백: control 반환
  return experiment.control;
}

// ── 메트릭 수집기 — Design §3 ──────────────────────────────────────────────

/** 실험 메트릭 저장소 */
export class ExperimentMetricStore {
  private readonly metrics: ExperimentMetric[] = [];

  /** 메트릭 기록 */
  record(metric: ExperimentMetric): void {
    this.metrics.push(metric);
  }

  /** 변형별 통계 집계 */
  getStats(experimentId: string, variantId: string): VariantStats {
    const filtered = this.metrics.filter(
      (m) => m.experimentId === experimentId && m.variantId === variantId,
    );

    if (filtered.length === 0) {
      return {
        variantId,
        sampleSize: 0,
        avgQualityScore: 0,
        avgLatencyMs: 0,
        avgTokensUsed: 0,
        positiveRate: 0,
        negativeRate: 0,
      };
    }

    const total = filtered.length;
    const sumQuality = filtered.reduce((s, m) => s + m.qualityScore, 0);
    const sumLatency = filtered.reduce((s, m) => s + m.latencyMs, 0);
    const sumTokens = filtered.reduce((s, m) => s + m.tokensUsed, 0);
    const positives = filtered.filter((m) => m.userFeedback === 'positive').length;
    const negatives = filtered.filter((m) => m.userFeedback === 'negative').length;
    const feedbackCount = positives + negatives;

    return {
      variantId,
      sampleSize: total,
      avgQualityScore: sumQuality / total,
      avgLatencyMs: sumLatency / total,
      avgTokensUsed: sumTokens / total,
      positiveRate: feedbackCount > 0 ? positives / feedbackCount : 0,
      negativeRate: feedbackCount > 0 ? negatives / feedbackCount : 0,
    };
  }

  /** 실험별 총 샘플 수 */
  sampleCount(experimentId: string): number {
    return this.metrics.filter((m) => m.experimentId === experimentId).length;
  }

  /** 전체 메트릭 수 */
  get size(): number {
    return this.metrics.length;
  }
}

// ── 통계 분석 — Design §4 ──────────────────────────────────────────────────

/**
 * Two-proportion Z-test
 * 두 변형의 긍정률 차이가 통계적으로 유의한지 검정
 */
export function zTest(
  controlStats: VariantStats,
  variantStats: VariantStats,
  alpha = 0.05,
): StatisticalResult {
  const n1 = controlStats.sampleSize;
  const n2 = variantStats.sampleSize;
  const p1 = controlStats.positiveRate;
  const p2 = variantStats.positiveRate;

  // 표본 크기 부족
  if (n1 < 30 || n2 < 30) {
    return {
      zScore: 0,
      pValue: 1,
      significant: false,
      verdict: 'inconclusive',
      controlStats,
      variantStats,
      confidenceInterval: { lower: 0, upper: 0 },
    };
  }

  // Pooled proportion
  const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  // Z-score 방지: se = 0
  if (se === 0) {
    return {
      zScore: 0,
      pValue: 1,
      significant: false,
      verdict: 'inconclusive',
      controlStats,
      variantStats,
      confidenceInterval: { lower: 0, upper: 0 },
    };
  }

  const zScore = (p2 - p1) / se;

  // p-value (양측 검정, 근사 계산)
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  // 95% 신뢰구간
  const seDiff = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
  const zCritical = 1.96;
  const diff = p2 - p1;

  const significant = pValue < alpha;
  let verdict: ExperimentVerdict = 'inconclusive';
  if (significant) {
    verdict = zScore > 0 ? 'variant_wins' : 'control_wins';
  }

  return {
    zScore: Math.round(zScore * 1000) / 1000,
    pValue: Math.round(pValue * 10000) / 10000,
    significant,
    verdict,
    controlStats,
    variantStats,
    confidenceInterval: {
      lower: Math.round((diff - zCritical * seDiff) * 10000) / 10000,
      upper: Math.round((diff + zCritical * seDiff) * 10000) / 10000,
    },
  };
}

/**
 * 표준 정규 분포 CDF 근사 (Abramowitz & Stegun)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// ── 실험 관리자 — Design §5,§6 ─────────────────────────────────────────────

/** 실험 관리자 */
export class ExperimentManager {
  private readonly experiments: Map<string, Experiment> = new Map();
  private readonly metricStore = new ExperimentMetricStore();

  /** 실험 생성 */
  createExperiment(config: {
    name: string;
    description: string;
    controlPrompt: string;
    variantPrompt: string;
    trafficSplit: number;
    minSampleSize?: number;
  }): Experiment {
    const experiment: Experiment = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: config.name,
      description: config.description,
      control: {
        id: 'control',
        name: 'Control',
        promptTemplate: config.controlPrompt,
        trafficPercent: 100 - config.trafficSplit,
      },
      variants: [{
        id: 'variant-a',
        name: 'Variant A',
        promptTemplate: config.variantPrompt,
        trafficPercent: config.trafficSplit,
      }],
      status: 'draft',
      minSampleSize: config.minSampleSize ?? 100,
      confidenceLevel: 0.95,
      metadata: {},
    };

    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  /** 실험 시작 */
  start(experimentId: string): Experiment | undefined {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'draft') return undefined;
    exp.status = 'running';
    exp.startedAt = new Date().toISOString();
    return exp;
  }

  /** 사용자에게 variant 할당 */
  assign(experimentId: string, userId: string): PromptVariant | undefined {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'running') return undefined;
    return assignVariant(userId, exp);
  }

  /** 메트릭 기록 */
  recordMetric(metric: ExperimentMetric): void {
    this.metricStore.record(metric);
  }

  /** 실험 분석 및 자동 판정 */
  analyze(experimentId: string): StatisticalResult | undefined {
    const exp = this.experiments.get(experimentId);
    if (!exp) return undefined;

    const controlStats = this.metricStore.getStats(experimentId, exp.control.id);
    const variantId = exp.variants[0]?.id;
    if (!variantId) return undefined;

    const variantStats = this.metricStore.getStats(experimentId, variantId);

    // 최소 표본 미달
    if (controlStats.sampleSize < exp.minSampleSize ||
        variantStats.sampleSize < exp.minSampleSize) {
      return {
        zScore: 0,
        pValue: 1,
        significant: false,
        verdict: 'inconclusive',
        controlStats,
        variantStats,
        confidenceInterval: { lower: 0, upper: 0 },
      };
    }

    return zTest(controlStats, variantStats, 1 - exp.confidenceLevel);
  }

  /** 실험 종료 */
  conclude(experimentId: string, verdict: ExperimentVerdict): Experiment | undefined {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'running') return undefined;
    exp.status = 'concluded';
    exp.concludedAt = new Date().toISOString();
    exp.verdict = verdict;
    return exp;
  }

  /** 실험 목록 */
  list(): Experiment[] {
    return [...this.experiments.values()];
  }

  /** 메트릭 저장소 접근 */
  get metrics(): ExperimentMetricStore {
    return this.metricStore;
  }
}
