/**
 * 탄소배출 추적 AI (Scope 1/2/3)
 * Design Ref: MTU-N451 §3
 * Plan SC: FR-CARBON.1~5
 */

import { z } from 'zod';

// CSAP D-12: 입력 검증
export const ActivityDataSchema = z.object({
  activityId: z.string().min(1),
  scope: z.enum(['1', '2', '3']),
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  unit: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  source: z.string().min(1),
});

export type ActivityData = z.infer<typeof ActivityDataSchema>;

export interface EmissionFactor {
  category: string;
  unit: string;
  co2eKgPerUnit: number;
  version: string;
  validFrom: string;
}

export interface EmissionResult {
  activityId: string;
  scope: '1' | '2' | '3';
  co2eKg: number;
  factorVersion: string;
  calculatedAt: string;
}

/**
 * 국가 배출계수 DB (FR-CARBON.4)
 * 실제 구현은 환경부 배출계수 API와 연동
 */
export class EmissionFactorDB {
  private factors = new Map<string, EmissionFactor>();

  constructor() {
    // 2026년 국가 고유 배출계수 (예시)
    this.register({
      category: 'electricity-grid-kr',
      unit: 'kWh',
      co2eKgPerUnit: 0.4594,
      version: '2026Q2',
      validFrom: '2026-01-01',
    });
    this.register({
      category: 'natural-gas',
      unit: 'Nm3',
      co2eKgPerUnit: 2.176,
      version: '2026Q2',
      validFrom: '2026-01-01',
    });
    this.register({
      category: 'diesel',
      unit: 'L',
      co2eKgPerUnit: 2.682,
      version: '2026Q2',
      validFrom: '2026-01-01',
    });
  }

  register(factor: EmissionFactor): void {
    this.factors.set(factor.category, factor);
  }

  get(category: string): EmissionFactor | undefined {
    return this.factors.get(category);
  }

  listVersions(): string[] {
    const versions = new Set<string>();
    for (const f of this.factors.values()) {
      versions.add(f.version);
    }
    return Array.from(versions);
  }
}

/**
 * Scope 1 직접 배출 계산기 (FR-CARBON.1)
 */
export class Scope1Calculator {
  constructor(private db: EmissionFactorDB) {}

  calculate(activity: ActivityData): EmissionResult {
    if (activity.scope !== '1') {
      throw new Error(`Scope 1 계산기는 scope=1만 처리 (받음: ${activity.scope})`);
    }
    const factor = this.db.get(activity.category);
    if (!factor) {
      throw new Error(`배출계수 없음: ${activity.category}`);
    }
    return {
      activityId: activity.activityId,
      scope: '1',
      co2eKg: activity.amount * factor.co2eKgPerUnit,
      factorVersion: factor.version,
      calculatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Scope 2 간접 배출 계산기 - 전력 (FR-CARBON.2)
 */
export class Scope2Calculator {
  constructor(private db: EmissionFactorDB) {}

  calculate(activity: ActivityData): EmissionResult {
    if (activity.scope !== '2') {
      throw new Error(`Scope 2 계산기는 scope=2만 처리`);
    }
    const factor = this.db.get(activity.category) ?? this.db.get('electricity-grid-kr');
    if (!factor) {
      throw new Error('기본 전력 배출계수 누락');
    }
    return {
      activityId: activity.activityId,
      scope: '2',
      co2eKg: activity.amount * factor.co2eKgPerUnit,
      factorVersion: factor.version,
      calculatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Scope 3 AI 추정기 - 기타 간접 (FR-CARBON.3)
 * 출장/구매/폐기물을 활동 기반 추정
 */
export class Scope3Estimator {
  private defaultFactors: Record<string, number> = {
    'business-travel-air-domestic': 0.158,
    'business-travel-air-international': 0.195,
    'purchased-goods-generic': 0.5,
    'waste-landfill': 0.467,
  };

  estimate(activity: ActivityData): EmissionResult {
    if (activity.scope !== '3') {
      throw new Error('Scope 3 추정기는 scope=3만 처리');
    }
    const factor = this.defaultFactors[activity.category] ?? 0.3;
    return {
      activityId: activity.activityId,
      scope: '3',
      co2eKg: activity.amount * factor,
      factorVersion: 'estimator-v1',
      calculatedAt: new Date().toISOString(),
    };
  }
}

/**
 * 리포트 집계기 (FR-CARBON.5)
 */
export interface PeriodReport {
  period: string;
  scope1Kg: number;
  scope2Kg: number;
  scope3Kg: number;
  totalKg: number;
  activityCount: number;
}

export class ReportAggregator {
  aggregate(results: EmissionResult[], period: string): PeriodReport {
    const report: PeriodReport = {
      period,
      scope1Kg: 0,
      scope2Kg: 0,
      scope3Kg: 0,
      totalKg: 0,
      activityCount: results.length,
    };
    for (const r of results) {
      if (r.scope === '1') report.scope1Kg += r.co2eKg;
      else if (r.scope === '2') report.scope2Kg += r.co2eKg;
      else report.scope3Kg += r.co2eKg;
    }
    report.totalKg = report.scope1Kg + report.scope2Kg + report.scope3Kg;
    return report;
  }

  compareToTarget(report: PeriodReport, targetKg: number): {
    achieved: boolean;
    gapKg: number;
    gapPercent: number;
  } {
    const gapKg = report.totalKg - targetKg;
    return {
      achieved: report.totalKg <= targetKg,
      gapKg,
      gapPercent: targetKg > 0 ? (gapKg / targetKg) * 100 : 0,
    };
  }
}

/**
 * 통합 탄소 추적 파사드
 */
export class CarbonTracker {
  private db = new EmissionFactorDB();
  private scope1 = new Scope1Calculator(this.db);
  private scope2 = new Scope2Calculator(this.db);
  private scope3 = new Scope3Estimator();
  private aggregator = new ReportAggregator();

  calculate(activity: ActivityData): EmissionResult {
    const validated = ActivityDataSchema.parse(activity);
    if (validated.scope === '1') return this.scope1.calculate(validated);
    if (validated.scope === '2') return this.scope2.calculate(validated);
    return this.scope3.estimate(validated);
  }

  report(activities: ActivityData[], period: string): PeriodReport {
    const results = activities.map((a) => this.calculate(a));
    return this.aggregator.aggregate(results, period);
  }

  getFactorDB(): EmissionFactorDB {
    return this.db;
  }
}
