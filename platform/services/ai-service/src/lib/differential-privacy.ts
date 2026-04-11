// 차등 프라이버시 엔진 -- FR-ADV35.4
// Design Ref: SVC-AI-ADV-R35 DESIGN §4
// Plan SC: SC-4 (데이터 추론 방지)
// CSAP: D-09 데이터 보호, N2SF C등급 데이터 AI 활용 보장

import { randomBytes } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 프라이버시 설정 */
export interface PrivacyConfig {
  /** 프라이버시 예산 (epsilon, 낮을수록 강력) */
  epsilon: number;
  /** 실패 확률 (delta) */
  delta: number;
  /** 그래디언트 클리핑 임계값 (L2 norm) */
  maxGradNorm: number;
  /** 노이즈 배율 (sigma) */
  noiseMultiplier: number;
  /** 최대 쿼리 수 (예산 소진 기준) */
  maxQueries: number;
}

/** 프라이버시 예산 상태 */
export interface PrivacyBudget {
  totalEpsilon: number;
  usedEpsilon: number;
  remainingEpsilon: number;
  queryCount: number;
  isExhausted: boolean;
}

/** 노이즈 추가 결과 */
export interface NoisyResult<T> {
  value: T;
  noiseAdded: number;
  epsilonUsed: number;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  epsilon: 1.0,
  delta: 1e-5,
  maxGradNorm: 1.0,
  noiseMultiplier: 1.1,
  maxQueries: 1000,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'differential-privacy',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- 안전한 난수 생성 ────────────────────────────────────────────────────────

function secureGaussian(mean: number, stddev: number): number {
  // Box-Muller 변환 (crypto 기반 안전 난수)
  const bytes1 = randomBytes(4);
  const bytes2 = randomBytes(4);
  const u1 = bytes1.readUInt32BE(0) / 0xFFFFFFFF;
  const u2 = bytes2.readUInt32BE(0) / 0xFFFFFFFF;

  const z0 = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z0;
}

// -- DifferentialPrivacy 메인 클래스 ──────────────────────────────────────────

/** 차등 프라이버시 엔진 -- Design §4 */
export class DifferentialPrivacy {
  private readonly config: PrivacyConfig;
  private queryCount: number = 0;
  private usedEpsilon: number = 0;

  constructor(config?: Partial<PrivacyConfig>) {
    this.config = { ...DEFAULT_PRIVACY_CONFIG, ...config };
  }

  // -- 그래디언트 클리핑 ─────────────────────────────────────────────────

  /** L2 norm 그래디언트 클리핑 -- Design §4 */
  clipGradients(gradients: number[]): number[] {
    const l2Norm = Math.sqrt(
      gradients.reduce((sum, g) => sum + g * g, 0),
    );

    if (l2Norm <= this.config.maxGradNorm) {
      return [...gradients];
    }

    const scale = this.config.maxGradNorm / l2Norm;
    return gradients.map((g) => g * scale);
  }

  // -- 가우시안 노이즈 주입 ──────────────────────────────────────────────

  /** 가우시안 노이즈 생성 (벡터) -- Design §4 */
  generateNoise(dimension: number): number[] {
    const sigma = this.config.noiseMultiplier * this.config.maxGradNorm;
    return Array.from({ length: dimension }, () => secureGaussian(0, sigma));
  }

  /** 그래디언트에 DP 노이즈 적용 */
  addNoiseToGradients(gradients: number[]): number[] {
    // 1. 클리핑
    const clipped = this.clipGradients(gradients);

    // 2. 노이즈 주입
    const noise = this.generateNoise(clipped.length);
    const noisy = clipped.map((g, i) => g + (noise[i] ?? 0));

    // 3. 예산 소비
    this.consumeBudget();

    return noisy;
  }

  // -- 스칼라 값 DP ──────────────────────────────────────────────────────

  /** 스칼라 값에 라플라스 노이즈 추가 */
  addLaplaceNoise(value: number, sensitivity: number): NoisyResult<number> {
    if (this.isExhausted()) {
      auditLog('budget_exhausted', { queryCount: this.queryCount });
      return { value, noiseAdded: 0, epsilonUsed: 0 };
    }

    const scale = sensitivity / this.config.epsilon;
    const bytes = randomBytes(8);
    const u = bytes.readDoubleBE(0) / Number.MAX_SAFE_INTEGER - 0.5;
    const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));

    this.consumeBudget();

    return {
      value: value + noise,
      noiseAdded: noise,
      epsilonUsed: this.config.epsilon / this.config.maxQueries,
    };
  }

  /** 스칼라 값에 가우시안 노이즈 추가 */
  addGaussianNoise(value: number, sensitivity: number): NoisyResult<number> {
    if (this.isExhausted()) {
      return { value, noiseAdded: 0, epsilonUsed: 0 };
    }

    const sigma =
      (sensitivity * Math.sqrt(2 * Math.log(1.25 / this.config.delta))) /
      this.config.epsilon;
    const noise = secureGaussian(0, sigma);

    this.consumeBudget();

    return {
      value: value + noise,
      noiseAdded: noise,
      epsilonUsed: this.config.epsilon / this.config.maxQueries,
    };
  }

  // -- 집계 DP ───────────────────────────────────────────────────────────

  /** DP 합계 */
  privateSum(values: number[], sensitivity: number): NoisyResult<number> {
    const trueSum = values.reduce((sum, v) => sum + v, 0);
    return this.addLaplaceNoise(trueSum, sensitivity);
  }

  /** DP 평균 */
  privateMean(values: number[], sensitivity: number): NoisyResult<number> {
    if (values.length === 0) return { value: 0, noiseAdded: 0, epsilonUsed: 0 };
    const sumResult = this.privateSum(values, sensitivity);
    return {
      value: sumResult.value / values.length,
      noiseAdded: sumResult.noiseAdded / values.length,
      epsilonUsed: sumResult.epsilonUsed,
    };
  }

  /** DP 카운트 */
  privateCount(predicate: boolean[]): NoisyResult<number> {
    const trueCount = predicate.filter(Boolean).length;
    return this.addLaplaceNoise(trueCount, 1);
  }

  // -- 예산 관리 ─────────────────────────────────────────────────────────

  /** 예산 소비 기록 */
  private consumeBudget(): void {
    this.queryCount += 1;
    this.usedEpsilon += this.config.epsilon / this.config.maxQueries;

    if (this.queryCount % 100 === 0) {
      auditLog('privacy_budget_usage', {
        queryCount: this.queryCount,
        usedEpsilon: this.usedEpsilon.toFixed(4),
        remainingEpsilon: (this.config.epsilon - this.usedEpsilon).toFixed(4),
      });
    }
  }

  /** 예산 소진 여부 */
  isExhausted(): boolean {
    return (
      this.queryCount >= this.config.maxQueries ||
      this.usedEpsilon >= this.config.epsilon
    );
  }

  /** 예산 상태 조회 */
  getBudget(): PrivacyBudget {
    return {
      totalEpsilon: this.config.epsilon,
      usedEpsilon: this.usedEpsilon,
      remainingEpsilon: Math.max(0, this.config.epsilon - this.usedEpsilon),
      queryCount: this.queryCount,
      isExhausted: this.isExhausted(),
    };
  }

  /** 예산 초기화 */
  resetBudget(): void {
    this.queryCount = 0;
    this.usedEpsilon = 0;
    auditLog('budget_reset', {});
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let dpInstance: DifferentialPrivacy | null = null;

export function getDifferentialPrivacy(
  config?: Partial<PrivacyConfig>,
): DifferentialPrivacy {
  if (!dpInstance) {
    dpInstance = new DifferentialPrivacy(config);
  }
  return dpInstance;
}

export function resetDifferentialPrivacy(): void {
  dpInstance = null;
}
