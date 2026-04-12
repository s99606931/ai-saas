// Design Ref: MTU-N451 §탄소배출 추적 AI
// Plan SC: FR-CARBON.1~5

export interface ActivityRecord {
  id: string;
  scope: 1 | 2 | 3;
  category: string;
  amount: number; // 활동량 (L, kWh, km 등)
  unit: string;
  period: string; // YYYY-MM
}

export interface EmissionFactor {
  category: string;
  factor: number; // kgCO2eq per unit
  unit: string;
  version: string;
  source: string;
}

export interface EmissionResult {
  activityId: string;
  scope: 1 | 2 | 3;
  emissionKgCO2: number;
  factorVersion: string;
}

export interface EmissionReport {
  period: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  targetDelta: number;
}

export class CarbonTrackingAi {
  private factors = new Map<string, EmissionFactor>();

  /** FR-CARBON.4 배출계수 등록 */
  registerFactor(factor: EmissionFactor): void {
    this.factors.set(factor.category, factor);
  }

  /** FR-CARBON.1 Scope 1 (연료) */
  calculateScope1(activity: ActivityRecord): EmissionResult {
    if (activity.scope !== 1) throw new Error('scope 불일치');
    const f = this.factors.get(activity.category);
    if (!f) throw new Error(`배출계수 없음: ${activity.category}`);
    return {
      activityId: activity.id,
      scope: 1,
      emissionKgCO2: +(activity.amount * f.factor).toFixed(3),
      factorVersion: f.version,
    };
  }

  /** FR-CARBON.2 Scope 2 (전력) */
  calculateScope2(activity: ActivityRecord): EmissionResult {
    if (activity.scope !== 2) throw new Error('scope 불일치');
    const f = this.factors.get(activity.category);
    if (!f) throw new Error(`배출계수 없음: ${activity.category}`);
    return {
      activityId: activity.id,
      scope: 2,
      emissionKgCO2: +(activity.amount * f.factor).toFixed(3),
      factorVersion: f.version,
    };
  }

  /** FR-CARBON.3 Scope 3 (AI 추정 - 기본 계수 기반) */
  estimateScope3(activity: ActivityRecord): EmissionResult {
    if (activity.scope !== 3) throw new Error('scope 불일치');
    const f = this.factors.get(activity.category);
    const factor = f?.factor ?? 0.5; // 기본값 추정
    return {
      activityId: activity.id,
      scope: 3,
      emissionKgCO2: +(activity.amount * factor).toFixed(3),
      factorVersion: f?.version ?? 'estimate-1.0',
    };
  }

  /** FR-CARBON.5 월별 집계 */
  aggregatePeriod(
    period: string,
    results: EmissionResult[],
    target: number,
  ): EmissionReport {
    const scope1 = results.filter((r) => r.scope === 1).reduce((s, r) => s + r.emissionKgCO2, 0);
    const scope2 = results.filter((r) => r.scope === 2).reduce((s, r) => s + r.emissionKgCO2, 0);
    const scope3 = results.filter((r) => r.scope === 3).reduce((s, r) => s + r.emissionKgCO2, 0);
    const total = +(scope1 + scope2 + scope3).toFixed(3);
    return {
      period,
      scope1: +scope1.toFixed(3),
      scope2: +scope2.toFixed(3),
      scope3: +scope3.toFixed(3),
      total,
      targetDelta: +(total - target).toFixed(3),
    };
  }
}

export const carbonTrackingAi = new CarbonTrackingAi();
