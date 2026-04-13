// Design Ref: §SVC-AI-ADV-R455 — AI 기반 인허가 자동 처리
// Plan SC: FR-R455.1~5

export type PermitType = 'building' | 'business' | 'environment';

export interface Application {
  readonly id: string;
  readonly type: PermitType;
  readonly applicant: string;
  readonly documents: readonly string[];
}

export type Decision = 'APPROVED' | 'NEED_DOCS' | 'REVIEW';

export interface ProcessResult {
  readonly id: string;
  readonly decision: Decision;
  readonly missing: readonly string[];
}

const REQUIRED_DOCS: Record<PermitType, readonly string[]> = {
  building: ['site_plan', 'structural_report', 'fire_safety', 'zoning_approval'],
  business: ['business_registration', 'tax_certificate', 'facility_inspection'],
  environment: ['environmental_impact', 'discharge_permit', 'waste_management_plan', 'monitoring_plan'],
};

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class PermitAutoProcessor {
  private readonly auditLog: AuditEvent[] = [];

  process(applications: readonly Application[]): readonly ProcessResult[] {
    const results: ProcessResult[] = applications.map(app => {
      const required = REQUIRED_DOCS[app.type];
      const missing = required.filter(doc => !app.documents.includes(doc));

      let decision: Decision;
      if (missing.length === 0) {
        decision = 'APPROVED';
      } else if (missing.length <= 1) {
        // Only 1 doc missing — ask for supplement
        decision = 'NEED_DOCS';
      } else {
        // Multiple missing or complex — send to manual review
        decision = missing.length >= 2 ? 'NEED_DOCS' : 'REVIEW';
      }

      // Complex types always go to REVIEW if any docs missing
      if (app.type === 'environment' && missing.length > 0) {
        decision = 'REVIEW';
      }

      return { id: app.id, decision, missing };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'permit.process',
      details: {
        applicationCount: applications.length,
        approved: results.filter(r => r.decision === 'APPROVED').length,
        needDocs: results.filter(r => r.decision === 'NEED_DOCS').length,
        review: results.filter(r => r.decision === 'REVIEW').length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
