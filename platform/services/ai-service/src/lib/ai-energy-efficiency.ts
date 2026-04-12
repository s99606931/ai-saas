// Design Ref: MTU-N423 §AI 에너지 효율
// Plan SC: FR-N423.1~5

export interface ModelEnergyProfile {
  modelId: string;
  tokensPerKwh: number;
  inferenceLatencyMs: number;
  qualityScore: number;
}

export interface UsageLog {
  modelId: string;
  tokens: number;
  requests: number;
  period: string;
}

export interface CarbonReport {
  modelId: string;
  tokens: number;
  kwh: number;
  gramsCO2: number;
  treeEquivalent: number;
}

export class AIEnergyEfficiency {
  /** FR-N423.1,2 탄소 발자국 계산 */
  calculateCarbon(
    log: UsageLog,
    profile: ModelEnergyProfile,
    gCO2PerKwh = 420,
  ): CarbonReport {
    const kwh = log.tokens / Math.max(1, profile.tokensPerKwh);
    const grams = kwh * gCO2PerKwh;
    const trees = grams / 21000;
    return {
      modelId: log.modelId,
      tokens: log.tokens,
      kwh: +kwh.toFixed(4),
      gramsCO2: +grams.toFixed(2),
      treeEquivalent: +trees.toFixed(6),
    };
  }

  /** FR-N423.3 효율 비교 */
  compareEfficiency(profiles: ModelEnergyProfile[]): Array<{
    modelId: string;
    efficiency: number;
    rank: number;
  }> {
    const withScore = profiles.map((p) => ({
      modelId: p.modelId,
      efficiency: +(p.tokensPerKwh * p.qualityScore).toFixed(2),
    }));
    withScore.sort((a, b) => b.efficiency - a.efficiency);
    return withScore.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  /** FR-N423.4 최적 모델 추천 */
  recommend(
    profiles: ModelEnergyProfile[],
    constraints: { minQuality?: number; maxLatencyMs?: number },
  ): ModelEnergyProfile | null {
    const eligible = profiles.filter((p) => {
      if (constraints.minQuality !== undefined && p.qualityScore < constraints.minQuality) return false;
      if (constraints.maxLatencyMs !== undefined && p.inferenceLatencyMs > constraints.maxLatencyMs) return false;
      return true;
    });
    if (eligible.length === 0) return null;
    return eligible.reduce((best, p) =>
      p.tokensPerKwh > best.tokensPerKwh ? p : best,
    );
  }

  /** FR-N423.5 절감 목표 달성도 */
  progressToGoal(
    baseline: CarbonReport,
    current: CarbonReport,
    reductionGoalPct: number,
  ): { reducedPct: number; achieved: boolean } {
    if (baseline.gramsCO2 <= 0) return { reducedPct: 0, achieved: false };
    const reduction = (baseline.gramsCO2 - current.gramsCO2) / baseline.gramsCO2;
    return {
      reducedPct: +(reduction * 100).toFixed(1),
      achieved: reduction * 100 >= reductionGoalPct,
    };
  }
}

export const aiEnergyEfficiency = new AIEnergyEfficiency();
