// Design Ref: §주류 허가 — 사업자 리스크 AI 평가
// Plan SC: FR-R548.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type LicenseType = 'retail' | 'wholesale' | 'manufacturing' | 'import';

export interface LicenseApplication {
  applicationId: string;
  businessName: string;
  licenseType: LicenseType;
  operatingYears: number;
  priorViolations: number;
  locationNearSchoolMeters: number;
  taxOverduesKRW: number;
}

export interface RiskAssessment {
  applicationId: string;
  riskScore: number; // 0~100
  decision: 'approve' | 'conditional' | 'reject';
  reasons: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AlcoholLicenseRiskAI {
  private applications = new Map<string, LicenseApplication>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R548.1
  submit(app: LicenseApplication, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (app.operatingYears < 0) throw new Error('영업 연수는 0 이상이어야 합니다');
    if (app.priorViolations < 0) throw new Error('위반 횟수는 0 이상이어야 합니다');
    if (app.locationNearSchoolMeters < 0) throw new Error('거리는 0 이상이어야 합니다');
    if (app.taxOverduesKRW < 0) throw new Error('체납액은 0 이상이어야 합니다');
    this.applications.set(app.applicationId, { ...app });
    this.append('SUBMIT', { applicationId: app.applicationId });
  }

  // Plan SC: FR-R548.2
  assess(applicationId: string, grade: DataGrade = 'O'): RiskAssessment {
    blockClassifiedData(grade);
    const app = this.applications.get(applicationId);
    if (!app) throw new Error(`신청서 미등록: ${applicationId}`);
    const reasons: string[] = [];
    let score = 0;

    if (app.locationNearSchoolMeters < 50) {
      score += 50;
      reasons.push('TOO_CLOSE_TO_SCHOOL');
    } else if (app.locationNearSchoolMeters < 200) {
      score += 20;
      reasons.push('NEAR_SCHOOL');
    }

    if (app.priorViolations >= 3) {
      score += 30;
      reasons.push('REPEAT_VIOLATOR');
    } else if (app.priorViolations >= 1) {
      score += 10;
      reasons.push('PRIOR_VIOLATION');
    }

    if (app.taxOverduesKRW > 10_000_000) {
      score += 20;
      reasons.push('LARGE_TAX_OVERDUE');
    } else if (app.taxOverduesKRW > 0) {
      score += 10;
      reasons.push('TAX_OVERDUE');
    }

    if (app.operatingYears < 1 && app.licenseType === 'manufacturing') {
      score += 10;
      reasons.push('NEW_MANUFACTURER');
    }

    score = Math.min(100, score);
    const decision: 'approve' | 'conditional' | 'reject' =
      score >= 60 ? 'reject' : score >= 30 ? 'conditional' : 'approve';

    const result: RiskAssessment = { applicationId, riskScore: score, decision, reasons };
    this.append('ASSESS', { applicationId, decision });
    return result;
  }

  // Plan SC: FR-R548.3
  listByDecision(decision: 'approve' | 'conditional' | 'reject'): string[] {
    const ids: string[] = [];
    for (const [id] of this.applications) {
      if (this.assess(id).decision === decision) ids.push(id);
    }
    return ids;
  }

  // Plan SC: FR-R548.4
  get(applicationId: string): LicenseApplication | undefined {
    const a = this.applications.get(applicationId);
    return a ? { ...a } : undefined;
  }

  // Plan SC: FR-R548.5
  count(): number {
    return this.applications.size;
  }

  // Plan SC: FR-R548.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
