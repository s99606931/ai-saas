// Design Ref: §청년 주거 매칭 — 다기준 적합도 랭킹
// Plan SC: FR-R527.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type HouseType = 'officetel' | 'one_room' | 'share_house' | 'public_rental';

export interface YouthApplicant {
  applicantId: string;
  age: number;
  monthlyIncomeKRW: number;
  budgetKRW: number;
  preferredRegion: string;
  preferredType: HouseType;
  needsSubsidy: boolean;
}

export interface Housing {
  housingId: string;
  type: HouseType;
  region: string;
  monthlyRentKRW: number;
  areaM2: number;
  subsidyEligible: boolean;
  available: boolean;
}

export interface MatchScore {
  housingId: string;
  score: number;
  reasons: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class YouthHousingMatchAI {
  private applicants = new Map<string, YouthApplicant>();
  private housings = new Map<string, Housing>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R527.1
  registerApplicant(app: YouthApplicant, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (app.age < 19 || app.age > 39) throw new Error('청년 대상 연령은 19~39세입니다');
    if (app.monthlyIncomeKRW < 0 || app.budgetKRW < 0) {
      throw new Error('소득과 예산은 0 이상이어야 합니다');
    }
    this.applicants.set(app.applicantId, { ...app });
    this.append('REGISTER_APPLICANT', { applicantId: app.applicantId });
  }

  // Plan SC: FR-R527.2
  registerHousing(housing: Housing, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (housing.monthlyRentKRW < 0 || housing.areaM2 <= 0) {
      throw new Error('임대료/면적이 올바르지 않습니다');
    }
    this.housings.set(housing.housingId, { ...housing });
    this.append('REGISTER_HOUSING', { housingId: housing.housingId, type: housing.type });
  }

  // Plan SC: FR-R527.3
  match(applicantId: string, grade: DataGrade = 'O'): MatchScore[] {
    blockClassifiedData(grade);
    const applicant = this.applicants.get(applicantId);
    if (!applicant) throw new Error(`신청자 미등록: ${applicantId}`);

    const results: MatchScore[] = [];
    for (const housing of this.housings.values()) {
      if (!housing.available) continue;
      let score = 0;
      const reasons: string[] = [];

      if (housing.region === applicant.preferredRegion) {
        score += 30;
        reasons.push('선호 지역 일치');
      }
      if (housing.type === applicant.preferredType) {
        score += 20;
        reasons.push('선호 주거 유형 일치');
      }
      if (housing.monthlyRentKRW <= applicant.budgetKRW) {
        score += 25;
        reasons.push('예산 내');
      } else {
        const overshoot = (housing.monthlyRentKRW - applicant.budgetKRW) / Math.max(1, applicant.budgetKRW);
        if (overshoot < 0.2) {
          score += 10;
          reasons.push('예산 20% 초과 이내');
        }
      }
      if (applicant.needsSubsidy && housing.subsidyEligible) {
        score += 15;
        reasons.push('공공 지원 가능');
      }
      if (applicant.monthlyIncomeKRW * 0.3 >= housing.monthlyRentKRW) {
        score += 10;
        reasons.push('소득 대비 임대료 안정적');
      }

      if (score > 0) results.push({ housingId: housing.housingId, score, reasons });
    }

    results.sort((a, b) => b.score - a.score);
    this.append('MATCH', { applicantId, candidateCount: results.length });
    return results;
  }

  // Plan SC: FR-R527.4
  listHousings(region?: string): Housing[] {
    const all = Array.from(this.housings.values());
    return (region ? all.filter(h => h.region === region) : all).map(h => ({ ...h }));
  }

  // Plan SC: FR-R527.5
  markUnavailable(housingId: string): void {
    const h = this.housings.get(housingId);
    if (!h) throw new Error(`주거 미등록: ${housingId}`);
    h.available = false;
    this.append('MARK_UNAVAILABLE', { housingId });
  }

  // Plan SC: FR-R527.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
