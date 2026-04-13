// SVC-AI-ADV-R455 AI 기반 인허가 자동 처리
// Design Ref: SVC-AI-ADV-R455.design.md
// Plan SC: FR-455.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type PermitType = 'building' | 'business' | 'environment';
export type Decision = 'APPROVED' | 'NEED_DOCS' | 'REVIEW';

export interface Application {
  readonly id: string;
  readonly type: PermitType;
  readonly applicant: string;
  readonly documents: readonly string[];
}

export interface ProcessResult {
  readonly id: string;
  readonly decision: Decision;
  readonly missing: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const REQUIRED_DOCS: Record<PermitType, readonly string[]> = {
  building: ['blueprint', 'landowner_consent', 'impact_assessment'],
  business: ['id_card', 'lease', 'insurance'],
  environment: ['eia_report', 'mitigation_plan'],
};

export class AIPermitProcessor {
  private readonly auditLog: AuditEntry[] = [];

  process(app: Application, grade: DataGrade = 'O'): ProcessResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 신청 데이터 차단 (N2SF N-05)`);
    }
    if (!app.id) throw new Error('INVALID_APPLICATION_ID');
    if (!app.applicant) throw new Error('INVALID_APPLICANT');

    const required = REQUIRED_DOCS[app.type];
    const missing = required.filter((d) => !app.documents.includes(d));
    let decision: Decision;
    if (missing.length > 0) {
      decision = 'NEED_DOCS';
    } else if (app.type === 'environment') {
      decision = 'REVIEW';
    } else {
      decision = 'APPROVED';
    }

    this.record('PROCESS', app.id, { type: app.type, decision });
    return { id: app.id, decision, missing };
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
