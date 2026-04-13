// Design Ref: §아동수당 — 연령·소득·거주 기반 자격 판정 AI
// Plan SC: FR-R543.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface ChildApplication {
  applicationId: string;
  childAgeMonths: number;
  householdIncomeKRW: number;
  residentInKorea: boolean;
  siblingCount: number;
}

export interface EligibilityResult {
  applicationId: string;
  eligible: boolean;
  monthlyAllowanceKRW: number;
  reasonCodes: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class ChildAllowanceEligibilityAI {
  private applications = new Map<string, ChildApplication>();
  private auditLog: AuditEntry[] = [];
  private maxAgeMonths = 95; // 만 7세 미만 (기본)
  private incomeCapKRW = 120_000_000; // 연 소득 상한

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R543.1
  apply(app: ChildApplication, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (app.childAgeMonths < 0 || app.childAgeMonths > 240) {
      throw new Error('아동 개월수가 유효하지 않습니다');
    }
    if (app.householdIncomeKRW < 0) throw new Error('소득은 0 이상이어야 합니다');
    if (app.siblingCount < 0) throw new Error('형제 수는 0 이상이어야 합니다');
    this.applications.set(app.applicationId, { ...app });
    this.append('APPLY', { applicationId: app.applicationId });
  }

  // Plan SC: FR-R543.2
  evaluate(applicationId: string, grade: DataGrade = 'O'): EligibilityResult {
    blockClassifiedData(grade);
    const app = this.applications.get(applicationId);
    if (!app) throw new Error(`신청서 미등록: ${applicationId}`);
    const reasonCodes: string[] = [];

    if (app.childAgeMonths > this.maxAgeMonths) reasonCodes.push('AGE_EXCEEDED');
    if (!app.residentInKorea) reasonCodes.push('NOT_RESIDENT');
    if (app.householdIncomeKRW > this.incomeCapKRW) reasonCodes.push('INCOME_OVER_CAP');

    const eligible = reasonCodes.length === 0;
    let amount = 0;
    if (eligible) {
      amount = 100_000; // 기본 월 10만원
      if (app.siblingCount >= 3) amount += 30_000;
      else if (app.siblingCount === 2) amount += 10_000;
    }
    const result: EligibilityResult = { applicationId, eligible, monthlyAllowanceKRW: amount, reasonCodes };
    this.append('EVALUATE', { applicationId, eligible });
    return result;
  }

  // Plan SC: FR-R543.3
  setIncomeCap(capKRW: number): void {
    if (capKRW < 0) throw new Error('상한은 0 이상이어야 합니다');
    this.incomeCapKRW = capKRW;
    this.append('SET_INCOME_CAP', { cap: capKRW });
  }

  // Plan SC: FR-R543.4
  setMaxAgeMonths(months: number): void {
    if (months < 0 || months > 240) throw new Error('최대 개월수는 0~240 범위여야 합니다');
    this.maxAgeMonths = months;
    this.append('SET_MAX_AGE', { months });
  }

  // Plan SC: FR-R543.5
  listApplications(): ChildApplication[] {
    return Array.from(this.applications.values()).map(a => ({ ...a }));
  }

  // Plan SC: FR-R543.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
