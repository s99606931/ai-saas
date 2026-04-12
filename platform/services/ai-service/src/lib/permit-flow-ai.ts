// 인허가/신고 자동화 AI 플로우 — FR-N397.1~5

export type PermitStage =
  | 'submitted'
  | 'document_check'
  | 'legal_review'
  | 'field_inspection'
  | 'decision'
  | 'approved'
  | 'rejected';

export interface PermitRequirement {
  code: string;
  description: string;
  mandatory: boolean;
}

export interface PermitType {
  code: string;
  name: string;
  slaBusinessDays: number;
  requirements: PermitRequirement[];
  disqualifiers: string[];
}

export interface PermitApplication {
  id: string;
  typeCode: string;
  applicantId: string;
  submittedDocs: Record<string, string>;
  stage: PermitStage;
  submittedAt: string;
  stageHistory: Array<{ stage: PermitStage; enteredAt: string }>;
  rejectionReasons: string[];
}

export interface ValidationResult {
  valid: boolean;
  missingDocs: string[];
  disqualifiersHit: string[];
}

export class PermitFlowAi {
  private readonly types = new Map<string, PermitType>();
  private readonly applications = new Map<string, PermitApplication>();

  registerType(type: PermitType): void {
    if (type.slaBusinessDays <= 0) throw new Error('PERMIT_INVALID_SLA');
    this.types.set(type.code, type);
  }

  submit(
    applicationId: string,
    typeCode: string,
    applicantId: string,
    docs: Record<string, string>,
  ): PermitApplication {
    if (!this.types.has(typeCode)) throw new Error('PERMIT_TYPE_NOT_FOUND');
    const now = new Date().toISOString();
    const app: PermitApplication = {
      id: applicationId,
      typeCode,
      applicantId,
      submittedDocs: docs,
      stage: 'submitted',
      submittedAt: now,
      stageHistory: [{ stage: 'submitted', enteredAt: now }],
      rejectionReasons: [],
    };
    this.applications.set(applicationId, app);
    return app;
  }

  validate(applicationId: string, narrativeText: string): ValidationResult {
    const app = this.requireApp(applicationId);
    const type = this.requireType(app.typeCode);
    const missingDocs = type.requirements
      .filter((r) => r.mandatory && !(r.code in app.submittedDocs))
      .map((r) => r.code);
    const disqualifiersHit = type.disqualifiers.filter((d) => narrativeText.includes(d));
    return {
      valid: missingDocs.length === 0 && disqualifiersHit.length === 0,
      missingDocs,
      disqualifiersHit,
    };
  }

  advance(applicationId: string, toStage: PermitStage): PermitApplication {
    const app = this.requireApp(applicationId);
    const order: PermitStage[] = [
      'submitted',
      'document_check',
      'legal_review',
      'field_inspection',
      'decision',
      'approved',
    ];
    const currentIdx = order.indexOf(app.stage);
    const targetIdx = order.indexOf(toStage);
    if (toStage !== 'rejected' && (targetIdx === -1 || targetIdx <= currentIdx)) {
      throw new Error('PERMIT_INVALID_STAGE_TRANSITION');
    }
    app.stage = toStage;
    app.stageHistory.push({ stage: toStage, enteredAt: new Date().toISOString() });
    return app;
  }

  reject(applicationId: string, reasons: string[]): PermitApplication {
    if (reasons.length === 0) throw new Error('PERMIT_REJECT_REASONS_REQUIRED');
    const app = this.requireApp(applicationId);
    app.stage = 'rejected';
    app.rejectionReasons = reasons;
    app.stageHistory.push({ stage: 'rejected', enteredAt: new Date().toISOString() });
    return app;
  }

  checkSlaStatus(applicationId: string, now: Date = new Date()): {
    overdue: boolean;
    daysUsed: number;
    daysAllowed: number;
  } {
    const app = this.requireApp(applicationId);
    const type = this.requireType(app.typeCode);
    const submitted = new Date(app.submittedAt);
    const diffDays = Math.floor((now.getTime() - submitted.getTime()) / 86400000);
    const businessDays = this.toBusinessDays(submitted, now);
    return {
      overdue: businessDays > type.slaBusinessDays && app.stage !== 'approved' && app.stage !== 'rejected',
      daysUsed: diffDays,
      daysAllowed: type.slaBusinessDays,
    };
  }

  private toBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count += 1;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  private requireApp(id: string): PermitApplication {
    const app = this.applications.get(id);
    if (!app) throw new Error('PERMIT_APP_NOT_FOUND');
    return app;
  }

  private requireType(code: string): PermitType {
    const t = this.types.get(code);
    if (!t) throw new Error('PERMIT_TYPE_NOT_FOUND');
    return t;
  }
}
