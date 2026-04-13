// Design Ref: §공공 임대 주택 AI — 자격 심사·우선순위 산정
// Plan SC: FR-R574.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type HouseholdType = 'single' | 'newlywed' | 'family' | 'senior' | 'disabled';

export interface RentalApplicant {
  applicantId: string;
  householdType: HouseholdType;
  householdSize: number;
  monthlyIncomeKRW: number;
  assetKRW: number;
  hasHousing: boolean;
  disabilityGrade: number; // 0 = none, 1~6
  yearsInRegion: number;
}

export interface RentalUnit {
  unitId: string;
  type: HouseholdType;
  rentKRW: number;
  depositKRW: number;
  areaM2: number;
  available: boolean;
}

export interface EligibilityResult {
  applicantId: string;
  eligible: boolean;
  priorityScore: number;
  reasons: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const INCOME_LIMIT_KRW = 5_000_000;
const ASSET_LIMIT_KRW = 300_000_000;

export class PublicRentalHousingAI {
  private applicants = new Map<string, RentalApplicant>();
  private units = new Map<string, RentalUnit>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R574.1
  registerApplicant(app: RentalApplicant, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (app.householdSize < 1) throw new Error('가구원 수는 1 이상이어야 합니다');
    if (app.monthlyIncomeKRW < 0 || app.assetKRW < 0) {
      throw new Error('소득/자산은 0 이상이어야 합니다');
    }
    this.applicants.set(app.applicantId, { ...app });
    this.append('REGISTER_APPLICANT', { applicantId: app.applicantId });
  }

  // Plan SC: FR-R574.2
  registerUnit(unit: RentalUnit, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (unit.rentKRW < 0 || unit.depositKRW < 0) {
      throw new Error('임대료/보증금은 0 이상이어야 합니다');
    }
    this.units.set(unit.unitId, { ...unit });
    this.append('REGISTER_UNIT', { unitId: unit.unitId });
  }

  // Plan SC: FR-R574.3
  evaluateEligibility(applicantId: string, grade: DataGrade = 'O'): EligibilityResult {
    blockClassifiedData(grade);
    const app = this.applicants.get(applicantId);
    if (!app) throw new Error(`신청자 미등록: ${applicantId}`);

    const reasons: string[] = [];
    let eligible = true;

    if (app.hasHousing) {
      eligible = false;
      reasons.push('기존 주택 보유');
    }
    if (app.monthlyIncomeKRW > INCOME_LIMIT_KRW) {
      eligible = false;
      reasons.push('소득 기준 초과');
    }
    if (app.assetKRW > ASSET_LIMIT_KRW) {
      eligible = false;
      reasons.push('자산 기준 초과');
    }

    let score = 0;
    if (eligible) {
      if (app.householdType === 'disabled' || app.disabilityGrade > 0) {
        score += 30;
        reasons.push('장애 가구 가점');
      }
      if (app.householdType === 'senior') {
        score += 25;
        reasons.push('노인 가구 가점');
      }
      if (app.householdType === 'newlywed') {
        score += 20;
        reasons.push('신혼 가구 가점');
      }
      if (app.householdSize >= 4) {
        score += 15;
        reasons.push('다자녀 가점');
      }
      if (app.yearsInRegion >= 5) {
        score += 10;
        reasons.push('지역 거주 가점');
      }
      if (app.monthlyIncomeKRW < 2_000_000) {
        score += 20;
        reasons.push('저소득 가점');
      }
    }

    this.append('EVALUATE_ELIGIBILITY', { applicantId, eligible, score });
    return { applicantId, eligible, priorityScore: score, reasons };
  }

  // Plan SC: FR-R574.4
  allocateUnit(applicantId: string): string | null {
    const app = this.applicants.get(applicantId);
    if (!app) throw new Error(`신청자 미등록: ${applicantId}`);
    const result = this.evaluateEligibility(applicantId);
    if (!result.eligible) return null;

    const match = Array.from(this.units.values())
      .filter(u => u.available && u.type === app.householdType)
      .sort((a, b) => a.rentKRW - b.rentKRW)[0];

    if (!match) return null;
    match.available = false;
    this.append('ALLOCATE_UNIT', { applicantId, unitId: match.unitId });
    return match.unitId;
  }

  // Plan SC: FR-R574.5
  listAvailableUnits(): RentalUnit[] {
    return Array.from(this.units.values())
      .filter(u => u.available)
      .map(u => ({ ...u }));
  }

  // Plan SC: FR-R574.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
