// Design Ref: §AI 공공연금 최적화 — 수급 개시 시점 시뮬레이션
// Plan SC: FR-R584.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface PensionProfile {
  subscriberId: string;
  currentAge: number;
  expectedRetirementAge: number;
  monthlyContributionKrw: number;
  yearsContributed: number;
  expectedLongevity: number; // 기대 수명
}

export interface PensionScenario {
  startAge: number;
  monthlyPayoutKrw: number;
  totalLifetimePayoutKrw: number;
  breakEvenAge: number;
}

export interface OptimizationResult {
  subscriberId: string;
  recommendedStartAge: number;
  scenarios: PensionScenario[];
  rationale: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const NORMAL_START_AGE = 65;

export class AIPublicPensionOptimizer {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  private computeMonthly(profile: PensionProfile, startAge: number): number {
    const baseAccumulation = profile.monthlyContributionKrw * 12 * profile.yearsContributed;
    const averageBase = baseAccumulation * 0.0015; // 월 기본 연금
    let adjustment = 1;
    if (startAge < NORMAL_START_AGE) {
      adjustment = 1 - 0.06 * (NORMAL_START_AGE - startAge); // 조기 수령 감액 6%/year
    } else if (startAge > NORMAL_START_AGE) {
      adjustment = 1 + 0.072 * (startAge - NORMAL_START_AGE); // 연기 수령 가산 7.2%/year
    }
    return Math.max(0, Math.round(averageBase * adjustment));
  }

  optimize(profile: PensionProfile, grade: DataGrade = 'O'): OptimizationResult {
    blockClassifiedData(grade);
    if (profile.currentAge < 0 || profile.yearsContributed < 0) {
      throw new Error('연령 및 납입 기간은 0 이상이어야 함');
    }
    if (profile.expectedLongevity <= profile.currentAge) {
      throw new Error('기대 수명이 현재 연령보다 낮음');
    }

    const startAges = [60, 63, 65, 67, 70];
    const scenarios: PensionScenario[] = startAges.map((age) => {
      const monthly = this.computeMonthly(profile, age);
      const monthsReceiving = Math.max(0, (profile.expectedLongevity - age) * 12);
      const lifetime = monthly * monthsReceiving;
      const baseMonthly = this.computeMonthly(profile, NORMAL_START_AGE);
      const diff = baseMonthly - monthly;
      const breakEvenAge = diff === 0 || age >= NORMAL_START_AGE
        ? age
        : Math.round(NORMAL_START_AGE + Math.abs((monthly * (NORMAL_START_AGE - age) * 12) / (diff * 12)));
      return {
        startAge: age,
        monthlyPayoutKrw: monthly,
        totalLifetimePayoutKrw: lifetime,
        breakEvenAge,
      };
    });

    const best = scenarios.reduce((a, b) =>
      b.totalLifetimePayoutKrw > a.totalLifetimePayoutKrw ? b : a,
    );

    const rationale =
      best.startAge > NORMAL_START_AGE
        ? `기대수명 ${profile.expectedLongevity}세 대비 연기 수령이 생애 총액에서 유리`
        : best.startAge < NORMAL_START_AGE
        ? '조기 수령이 현금 흐름 최적화에 유리'
        : '정상 수령 연령이 최적';

    this.log('OPTIMIZE', {
      subscriberId: profile.subscriberId,
      recommended: best.startAge,
      lifetime: best.totalLifetimePayoutKrw,
    });

    return {
      subscriberId: profile.subscriberId,
      recommendedStartAge: best.startAge,
      scenarios,
      rationale,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
