// Design Ref: §농업 보조금 최적화 — 작물·면적·환경기여 기반 배분
// Plan SC: FR-R559.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type CropType = 'rice' | 'vegetable' | 'fruit' | 'grain' | 'livestock' | 'organic';

export interface FarmApplication {
  farmId: string;
  cropType: CropType;
  areaHa: number;
  yearsOfOperation: number;
  sustainabilityScore: number; // 0~100
  incomeLastYearKRW: number;
}

export interface SubsidyAllocation {
  farmId: string;
  baseGrantKRW: number;
  sustainabilityBonusKRW: number;
  incomeSupplementKRW: number;
  totalKRW: number;
  rationale: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const BASE_RATE_KRW_PER_HA: Record<CropType, number> = {
  rice: 600_000,
  vegetable: 450_000,
  fruit: 500_000,
  grain: 550_000,
  livestock: 400_000,
  organic: 800_000,
};

export class AgricultureSubsidyOptimizer {
  private applications = new Map<string, FarmApplication>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R559.1
  submit(app: FarmApplication, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (app.areaHa <= 0) throw new Error('경작 면적은 0보다 커야 합니다');
    if (app.yearsOfOperation < 0) throw new Error('운영 연수는 0 이상이어야 합니다');
    if (app.sustainabilityScore < 0 || app.sustainabilityScore > 100) {
      throw new Error('지속가능성 점수는 0~100 범위여야 합니다');
    }
    if (app.incomeLastYearKRW < 0) throw new Error('전년도 소득은 0 이상이어야 합니다');
    this.applications.set(app.farmId, { ...app });
    this.append('SUBMIT', { farmId: app.farmId, cropType: app.cropType });
  }

  // Plan SC: FR-R559.2
  computeAllocation(farmId: string, grade: DataGrade = 'O'): SubsidyAllocation {
    blockClassifiedData(grade);
    const app = this.applications.get(farmId);
    if (!app) throw new Error(`신청 미등록: ${farmId}`);

    const rate = BASE_RATE_KRW_PER_HA[app.cropType];
    const baseGrant = Math.round(rate * app.areaHa);

    const sustainabilityRatio = app.sustainabilityScore / 100;
    const sustainabilityBonus = Math.round(baseGrant * 0.3 * sustainabilityRatio);

    const rationale: string[] = [];
    rationale.push(`기본 보조: ${app.cropType} ${app.areaHa}ha`);
    rationale.push(`지속가능성 가산: ${Math.round(sustainabilityRatio * 100)}%`);

    // Income-based supplement (for low-income farms)
    const LOW_INCOME_THRESHOLD = 20_000_000;
    let incomeSupplement = 0;
    if (app.incomeLastYearKRW < LOW_INCOME_THRESHOLD) {
      incomeSupplement = Math.round((LOW_INCOME_THRESHOLD - app.incomeLastYearKRW) * 0.1);
      rationale.push('저소득 농가 보전 수당');
    }

    // Longevity bonus for 10+ year farms
    if (app.yearsOfOperation >= 10) {
      const longevity = Math.round(baseGrant * 0.05);
      incomeSupplement += longevity;
      rationale.push(`장기 운영 가산 (${app.yearsOfOperation}년)`);
    }

    const totalKRW = baseGrant + sustainabilityBonus + incomeSupplement;

    const result: SubsidyAllocation = {
      farmId,
      baseGrantKRW: baseGrant,
      sustainabilityBonusKRW: sustainabilityBonus,
      incomeSupplementKRW: incomeSupplement,
      totalKRW,
      rationale,
    };
    this.append('COMPUTE_ALLOCATION', { farmId, totalKRW });
    return result;
  }

  // Plan SC: FR-R559.3
  optimizeBudget(totalBudgetKRW: number, grade: DataGrade = 'O'): SubsidyAllocation[] {
    blockClassifiedData(grade);
    if (totalBudgetKRW <= 0) throw new Error('총 예산은 0보다 커야 합니다');
    const allocations = Array.from(this.applications.keys()).map(id => this.computeAllocation(id));
    const rawTotal = allocations.reduce((sum, a) => sum + a.totalKRW, 0);
    if (rawTotal <= totalBudgetKRW) return allocations;

    const ratio = totalBudgetKRW / rawTotal;
    const scaled = allocations.map(a => ({
      ...a,
      baseGrantKRW: Math.round(a.baseGrantKRW * ratio),
      sustainabilityBonusKRW: Math.round(a.sustainabilityBonusKRW * ratio),
      incomeSupplementKRW: Math.round(a.incomeSupplementKRW * ratio),
      totalKRW: Math.round(a.totalKRW * ratio),
      rationale: [...a.rationale, `예산 한도 ${Math.round(ratio * 100)}% 비례 조정`],
    }));
    this.append('OPTIMIZE_BUDGET', { totalBudgetKRW, scale: ratio });
    return scaled;
  }

  // Plan SC: FR-R559.4
  totalAreaByCrop(): Record<CropType, number> {
    const result: Record<CropType, number> = {
      rice: 0,
      vegetable: 0,
      fruit: 0,
      grain: 0,
      livestock: 0,
      organic: 0,
    };
    for (const a of this.applications.values()) result[a.cropType] += a.areaHa;
    return result;
  }

  // Plan SC: FR-R559.5
  listApplications(cropType?: CropType): FarmApplication[] {
    const all = Array.from(this.applications.values());
    return (cropType ? all.filter(a => a.cropType === cropType) : all).map(a => ({ ...a }));
  }

  // Plan SC: FR-R559.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
