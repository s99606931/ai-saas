// Design Ref: MTU-N451 §carbon-tracker
// Plan SC: FR-CARBON.1 ~ FR-CARBON.5
//
// GHG Protocol 기반 Scope 1/2/3 탄소배출량 산정.
// 의존성 최소화 — 순수 TypeScript 구현. 외부 클라우드 서비스 호출 없음.
// 배출계수 기본값은 환경부 국가 고유 배출계수(공개 자료)를 인라인 상수로 내장.

export type FuelType = 'diesel' | 'gasoline' | 'lng' | 'lpg' | 'coal';
export type Scope3Category =
  | 'business_travel'
  | 'purchased_goods'
  | 'waste'
  | 'employee_commute'
  | 'upstream_transport';

export interface Scope1Activity {
  fuel: FuelType;
  amount: number; // 연료 사용량 (L 또는 kg)
  unit: 'L' | 'kg';
}

export interface Scope2Activity {
  kwh: number; // 전력 사용량
  gridRegion?: 'KR' | 'KR-JEJU'; // 지역별 배출계수 적용
}

export interface Scope3Activity {
  category: Scope3Category;
  amount: number;
  unit: 'km' | 'ton' | 'count' | 'krw';
}

export interface EmissionResult {
  scope: 1 | 2 | 3;
  tCO2e: number; // tonnes CO2 equivalent
  factorVersion: string;
  breakdown: Record<string, number>;
}

export interface AggregateReport {
  period: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  reductionTargetTco2e?: number;
  gapTco2e?: number;
  factorVersion: string;
}

// FR-CARBON.4: 배출계수 DB 버저닝 — 기본값은 환경부 2025년 고시 기준
// NOTE: 운영 환경에서는 EmissionFactorDB 인터페이스를 통해 외부 DB 로드 가능.
const DEFAULT_FACTOR_VERSION = '2025-ME-KR-v1';

const SCOPE1_FACTORS: Record<FuelType, { perL?: number; perKg?: number }> = {
  diesel: { perL: 0.00268 }, // t CO2e / L
  gasoline: { perL: 0.00231 },
  lng: { perKg: 0.00272 },
  lpg: { perKg: 0.00299 },
  coal: { perKg: 0.00241 },
};

const SCOPE2_FACTORS: Record<'KR' | 'KR-JEJU', number> = {
  KR: 0.000459, // t CO2e / kWh (2025 국가 고유 전력 배출계수)
  'KR-JEJU': 0.000412,
};

const SCOPE3_FACTORS: Record<Scope3Category, Record<string, number>> = {
  business_travel: { km: 0.000157 }, // 항공 평균
  purchased_goods: { krw: 0.00000031 }, // 구매액 기반 추정
  waste: { ton: 0.467 }, // 일반 폐기물 소각
  employee_commute: { km: 0.000121 },
  upstream_transport: { km: 0.000094 },
};

// FR-CARBON.4: 배출계수 DB 인터페이스 (확장 지점)
export interface EmissionFactorDB {
  version: string;
  scope1(fuel: FuelType): { perL?: number; perKg?: number } | null;
  scope2(region: 'KR' | 'KR-JEJU'): number | null;
  scope3(category: Scope3Category, unit: string): number | null;
}

export class DefaultFactorDB implements EmissionFactorDB {
  readonly version = DEFAULT_FACTOR_VERSION;

  scope1(fuel: FuelType): { perL?: number; perKg?: number } | null {
    return SCOPE1_FACTORS[fuel] ?? null;
  }

  scope2(region: 'KR' | 'KR-JEJU'): number | null {
    return SCOPE2_FACTORS[region] ?? null;
  }

  scope3(category: Scope3Category, unit: string): number | null {
    const entry = SCOPE3_FACTORS[category];
    if (!entry) return null;
    return entry[unit] ?? null;
  }
}

// FR-CARBON.1: Scope 1 (직접 배출) 자동 계산
export class Scope1Calculator {
  constructor(private db: EmissionFactorDB = new DefaultFactorDB()) {}

  calculate(activities: Scope1Activity[]): EmissionResult {
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const act of activities) {
      const factors = this.db.scope1(act.fuel);
      if (!factors) {
        throw new Error(`Unknown fuel type: ${act.fuel}`);
      }
      const coeff = act.unit === 'L' ? factors.perL : factors.perKg;
      if (coeff === undefined) {
        throw new Error(`No factor for fuel=${act.fuel} unit=${act.unit}`);
      }
      const tco2e = round6(act.amount * coeff);
      breakdown[act.fuel] = round6((breakdown[act.fuel] ?? 0) + tco2e);
      total += tco2e;
    }
    return {
      scope: 1,
      tCO2e: round6(total),
      factorVersion: this.db.version,
      breakdown,
    };
  }
}

// FR-CARBON.2: Scope 2 (간접-전력) 자동 계산
export class Scope2Calculator {
  constructor(private db: EmissionFactorDB = new DefaultFactorDB()) {}

  calculate(activities: Scope2Activity[]): EmissionResult {
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const act of activities) {
      const region = act.gridRegion ?? 'KR';
      const factor = this.db.scope2(region);
      if (factor == null) {
        throw new Error(`Unknown grid region: ${region}`);
      }
      const tco2e = round6(act.kwh * factor);
      breakdown[region] = round6((breakdown[region] ?? 0) + tco2e);
      total += tco2e;
    }
    return {
      scope: 2,
      tCO2e: round6(total),
      factorVersion: this.db.version,
      breakdown,
    };
  }
}

// FR-CARBON.3: Scope 3 (기타 간접) AI 추정
// NOTE: "AI 추정"은 배출계수 DB 매칭 + 활동량 기반 산정. N2SF C/S등급 데이터는
//       절대 외부 AI API로 전송하지 않음. 모든 계산은 로컬 배출계수로 수행.
export class Scope3Estimator {
  constructor(private db: EmissionFactorDB = new DefaultFactorDB()) {}

  estimate(activities: Scope3Activity[]): EmissionResult {
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const act of activities) {
      const factor = this.db.scope3(act.category, act.unit);
      if (factor == null) {
        throw new Error(`No factor for category=${act.category} unit=${act.unit}`);
      }
      const tco2e = round6(act.amount * factor);
      breakdown[act.category] = round6((breakdown[act.category] ?? 0) + tco2e);
      total += tco2e;
    }
    return {
      scope: 3,
      tCO2e: round6(total),
      factorVersion: this.db.version,
      breakdown,
    };
  }
}

// FR-CARBON.5: 월별/분기별/연간 집계 + 감축 목표 대비 분석
export class ReportAggregator {
  aggregate(params: {
    period: string;
    scope1: EmissionResult;
    scope2: EmissionResult;
    scope3: EmissionResult;
    reductionTargetTco2e?: number;
  }): AggregateReport {
    const total = round6(
      params.scope1.tCO2e + params.scope2.tCO2e + params.scope3.tCO2e,
    );
    const gap =
      params.reductionTargetTco2e !== undefined
        ? round6(total - params.reductionTargetTco2e)
        : undefined;
    return {
      period: params.period,
      scope1: params.scope1.tCO2e,
      scope2: params.scope2.tCO2e,
      scope3: params.scope3.tCO2e,
      total,
      reductionTargetTco2e: params.reductionTargetTco2e,
      gapTco2e: gap,
      factorVersion: params.scope1.factorVersion,
    };
  }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
