// Design Ref: §보훈 혜택 어드바이저 — 자격 매칭·혜택 추천 엔진
// Plan SC: FR-R557.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type VeteranCategory = 'combat' | 'service' | 'disabled' | 'bereaved' | 'meritorious';

export interface VeteranProfile {
  veteranId: string; // pseudonymized
  category: VeteranCategory;
  disabilityGrade?: number; // 1~7, optional
  serviceYears: number;
  ageYears: number;
  incomeLevel: 'low' | 'medium' | 'high';
}

export interface BenefitDefinition {
  benefitId: string;
  name: string;
  eligibleCategories: VeteranCategory[];
  minServiceYears: number;
  maxIncomeLevel: 'low' | 'medium' | 'high';
  maxDisabilityGrade?: number;
  monthlyAmountKRW: number;
}

export interface EligibilityResult {
  veteranId: string;
  eligibleBenefits: string[];
  totalMonthlyKRW: number;
  reasons: Record<string, string>;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const INCOME_RANK: Record<'low' | 'medium' | 'high', number> = { low: 1, medium: 2, high: 3 };

export class VeteranBenefitAdvisor {
  private veterans = new Map<string, VeteranProfile>();
  private benefits = new Map<string, BenefitDefinition>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R557.1
  registerVeteran(v: VeteranProfile, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (v.serviceYears < 0) throw new Error('복무 기간은 0 이상이어야 합니다');
    if (v.ageYears < 0 || v.ageYears > 130) throw new Error('연령이 올바르지 않습니다');
    if (v.disabilityGrade !== undefined && (v.disabilityGrade < 1 || v.disabilityGrade > 7)) {
      throw new Error('상이 등급은 1~7 범위여야 합니다');
    }
    this.veterans.set(v.veteranId, { ...v });
    this.append('REGISTER_VETERAN', { veteranId: v.veteranId, category: v.category });
  }

  // Plan SC: FR-R557.2
  defineBenefit(b: BenefitDefinition): void {
    if (b.monthlyAmountKRW < 0) throw new Error('혜택 금액은 0 이상이어야 합니다');
    if (b.minServiceYears < 0) throw new Error('최소 복무 기간은 0 이상이어야 합니다');
    this.benefits.set(b.benefitId, { ...b, eligibleCategories: [...b.eligibleCategories] });
    this.append('DEFINE_BENEFIT', { benefitId: b.benefitId });
  }

  // Plan SC: FR-R557.3
  matchBenefits(veteranId: string, grade: DataGrade = 'O'): EligibilityResult {
    blockClassifiedData(grade);
    const v = this.veterans.get(veteranId);
    if (!v) throw new Error(`보훈대상자 미등록: ${veteranId}`);

    const eligible: string[] = [];
    const reasons: Record<string, string> = {};
    let totalMonthly = 0;

    for (const b of this.benefits.values()) {
      if (!b.eligibleCategories.includes(v.category)) continue;
      if (v.serviceYears < b.minServiceYears) continue;
      if (INCOME_RANK[v.incomeLevel] > INCOME_RANK[b.maxIncomeLevel]) continue;
      if (b.maxDisabilityGrade !== undefined) {
        if (v.disabilityGrade === undefined || v.disabilityGrade > b.maxDisabilityGrade) continue;
      }
      eligible.push(b.benefitId);
      reasons[b.benefitId] = `${b.name} 자격 충족`;
      totalMonthly += b.monthlyAmountKRW;
    }

    const result: EligibilityResult = {
      veteranId,
      eligibleBenefits: eligible,
      totalMonthlyKRW: totalMonthly,
      reasons,
    };
    this.append('MATCH_BENEFITS', { veteranId, count: eligible.length, totalMonthly });
    return result;
  }

  // Plan SC: FR-R557.4
  listBenefits(category?: VeteranCategory): BenefitDefinition[] {
    const all = Array.from(this.benefits.values());
    return (category ? all.filter(b => b.eligibleCategories.includes(category)) : all).map(b => ({
      ...b,
      eligibleCategories: [...b.eligibleCategories],
    }));
  }

  // Plan SC: FR-R557.5
  countByCategory(): Record<VeteranCategory, number> {
    const result: Record<VeteranCategory, number> = {
      combat: 0,
      service: 0,
      disabled: 0,
      bereaved: 0,
      meritorious: 0,
    };
    for (const v of this.veterans.values()) result[v.category] += 1;
    return result;
  }

  // Plan SC: FR-R557.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
