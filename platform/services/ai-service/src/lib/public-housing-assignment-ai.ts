// Design Ref: §공공 주택 배정 AI
// Plan SC: FR-R626.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type HousingType = 'studio' | 'one_bed' | 'two_bed' | 'three_bed';

interface HousingUnit {
  unitId: string;
  type: HousingType;
  monthlyRent: number;
  available: boolean;
}

interface Applicant {
  applicantId: string;
  familySize: number;
  monthlyIncome: number;
  hasDisability: boolean;
  isElderly: boolean;
  hasMinorChildren: boolean;
  waitingMonths: number;
}

interface Assignment {
  applicantId: string;
  unitId: string;
  priorityScore: number;
  matchedReason: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const TYPE_BY_FAMILY: Record<number, HousingType> = {
  1: 'studio',
  2: 'one_bed',
  3: 'two_bed',
  4: 'three_bed',
};

export class PublicHousingAssignmentAI {
  private units = new Map<string, HousingUnit>();
  private applicants = new Map<string, Applicant>();
  private assignments: Assignment[] = [];
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R626.1
  registerUnit(u: HousingUnit, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (u.monthlyRent < 0) throw new Error('월세 음수 불가');
    this.units.set(u.unitId, u);
    this.log('REGISTER_UNIT', { unitId: u.unitId });
  }

  registerApplicant(a: Applicant, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (a.familySize <= 0) throw new Error('가족 수 > 0');
    this.applicants.set(a.applicantId, a);
    this.log('REGISTER_APPLICANT', { applicantId: a.applicantId });
  }

  // Plan SC: FR-R626.2
  private computePriority(a: Applicant): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    // 대기 기간
    score += Math.min(40, a.waitingMonths * 0.8);
    if (a.waitingMonths > 12) reasons.push(`장기 대기(${a.waitingMonths}개월)`);
    // 취약 계층
    if (a.hasDisability) {
      score += 20;
      reasons.push('장애 가구');
    }
    if (a.isElderly) {
      score += 15;
      reasons.push('고령자');
    }
    if (a.hasMinorChildren) {
      score += 10;
      reasons.push('미성년 자녀');
    }
    // 저소득 가산점
    if (a.monthlyIncome < 2_000_000) {
      score += 15;
      reasons.push('저소득');
    }
    return { score: Math.min(100, +score.toFixed(1)), reasons };
  }

  // Plan SC: FR-R626.3
  private matchType(familySize: number): HousingType {
    const capped = Math.min(4, Math.max(1, familySize));
    return TYPE_BY_FAMILY[capped] ?? 'studio';
  }

  // Plan SC: FR-R626.4
  runAssignment(grade: DataGrade = DataGrade.O): Assignment[] {
    blockClassifiedData(grade);
    // 우선순위로 정렬
    const ranked = Array.from(this.applicants.values())
      .map((a) => ({ applicant: a, ...this.computePriority(a) }))
      .sort((x, y) => y.score - x.score);

    const results: Assignment[] = [];
    for (const r of ranked) {
      const type = this.matchType(r.applicant.familySize);
      const availableUnit = Array.from(this.units.values()).find(
        (u) => u.available && u.type === type && u.monthlyRent <= r.applicant.monthlyIncome * 0.3,
      );
      if (availableUnit) {
        availableUnit.available = false;
        results.push({
          applicantId: r.applicant.applicantId,
          unitId: availableUnit.unitId,
          priorityScore: r.score,
          matchedReason: [`가구규모 ${r.applicant.familySize}→${type}`, ...r.reasons],
        });
      }
    }
    this.assignments = results;
    this.log('RUN_ASSIGNMENT', { matched: results.length, total: ranked.length });
    return results;
  }

  // Plan SC: FR-R626.5
  getAssignments(): readonly Assignment[] {
    return this.assignments;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
