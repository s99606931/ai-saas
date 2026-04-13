// Design Ref: §복지 급여 매칭 AI — 다급여 자격 판별
// Plan SC: FR-R577.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface Household {
  householdId: string;
  memberCount: number;
  monthlyIncomeKRW: number;
  assetKRW: number;
  hasElderly: boolean;
  hasDisabled: boolean;
  hasChildren: boolean;
  isSingleParent: boolean;
  isUnemployed: boolean;
}

export interface BenefitProgram {
  programId: string;
  name: string;
  maxIncomeKRW: number;
  maxAssetKRW: number;
  requiresElderly?: boolean;
  requiresDisabled?: boolean;
  requiresChildren?: boolean;
  requiresSingleParent?: boolean;
  requiresUnemployed?: boolean;
  monthlyAmountKRW: number;
}

export interface BenefitMatch {
  programId: string;
  name: string;
  monthlyAmountKRW: number;
  eligible: boolean;
  reasons: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class WelfareBenefitMatchingAI {
  private households = new Map<string, Household>();
  private programs = new Map<string, BenefitProgram>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R577.1
  registerHousehold(h: Household, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (h.memberCount < 1) throw new Error('가구원 수는 1 이상이어야 합니다');
    this.households.set(h.householdId, { ...h });
    this.append('REGISTER_HOUSEHOLD', { householdId: h.householdId });
  }

  // Plan SC: FR-R577.2
  registerProgram(p: BenefitProgram, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (p.monthlyAmountKRW < 0) throw new Error('지원금액은 0 이상이어야 합니다');
    this.programs.set(p.programId, { ...p });
    this.append('REGISTER_PROGRAM', { programId: p.programId });
  }

  // Plan SC: FR-R577.3
  matchBenefits(householdId: string, grade: DataGrade = 'O'): BenefitMatch[] {
    blockClassifiedData(grade);
    const h = this.households.get(householdId);
    if (!h) throw new Error(`가구 미등록: ${householdId}`);

    const results: BenefitMatch[] = [];
    for (const p of this.programs.values()) {
      const reasons: string[] = [];
      let eligible = true;

      if (h.monthlyIncomeKRW > p.maxIncomeKRW) {
        eligible = false;
        reasons.push('소득 기준 초과');
      }
      if (h.assetKRW > p.maxAssetKRW) {
        eligible = false;
        reasons.push('자산 기준 초과');
      }
      if (p.requiresElderly && !h.hasElderly) {
        eligible = false;
        reasons.push('노인 포함 요건 미충족');
      }
      if (p.requiresDisabled && !h.hasDisabled) {
        eligible = false;
        reasons.push('장애인 포함 요건 미충족');
      }
      if (p.requiresChildren && !h.hasChildren) {
        eligible = false;
        reasons.push('아동 포함 요건 미충족');
      }
      if (p.requiresSingleParent && !h.isSingleParent) {
        eligible = false;
        reasons.push('한부모 요건 미충족');
      }
      if (p.requiresUnemployed && !h.isUnemployed) {
        eligible = false;
        reasons.push('실직 요건 미충족');
      }

      if (eligible) reasons.push('모든 자격 충족');

      results.push({
        programId: p.programId,
        name: p.name,
        monthlyAmountKRW: p.monthlyAmountKRW,
        eligible,
        reasons,
      });
    }

    this.append('MATCH_BENEFITS', { householdId, count: results.length });
    return results;
  }

  // Plan SC: FR-R577.4
  getTotalPotentialBenefit(householdId: string): number {
    const matches = this.matchBenefits(householdId);
    return matches.filter(m => m.eligible).reduce((s, m) => s + m.monthlyAmountKRW, 0);
  }

  // Plan SC: FR-R577.5
  listPrograms(): BenefitProgram[] {
    return Array.from(this.programs.values()).map(p => ({ ...p }));
  }

  // Plan SC: FR-R577.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
