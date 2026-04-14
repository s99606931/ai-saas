// Design Ref: SVC-AI-ADV-R695.design.md — AI기반 문서 워크플로우 자동화 v3
// Plan SC: FR-R695.1~5

import { createHash } from 'crypto';

export type WorkflowStatus = 'ACTIVE' | 'STALLED' | 'DONE';

interface WorkflowTemplate {
  templateId: string;
  steps: string[];
}
interface DraftDocument {
  docId: string;
  templateId: string;
  drafterId: string;
  completedSteps: number;
  pendingDays: number;
}
interface WorkflowVerdict {
  docId: string;
  progress: number;
  status: WorkflowStatus;
  maskedDrafterId: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class DocumentWorkflowAIV3 {
  private templates = new Map<string, WorkflowTemplate>();
  private auditLog: AuditEntry[] = [];

  registerTemplate(tpl: WorkflowTemplate): void {
    if (tpl.steps.length === 0) {
      throw new Error('EMPTY_STEPS');
    }
    this.templates.set(tpl.templateId, tpl);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_TEMPLATE',
      details: { templateId: tpl.templateId, stepCount: tpl.steps.length },
    });
  }

  draftDocument(doc: DraftDocument, dataGrade?: string): WorkflowVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const tpl = this.templates.get(doc.templateId);
    if (!tpl) {
      throw new Error(`UNKNOWN_TEMPLATE: ${doc.templateId}`);
    }
    if (doc.completedSteps < 0 || doc.completedSteps > tpl.steps.length) {
      throw new Error('INVALID_COMPLETED_STEPS');
    }
    if (doc.pendingDays < 0) {
      throw new Error('INVALID_PENDING_DAYS');
    }

    const progress = (doc.completedSteps / tpl.steps.length) * 100;
    let status: WorkflowStatus;
    if (progress >= 100) status = 'DONE';
    else if (doc.pendingDays > 7) status = 'STALLED';
    else status = 'ACTIVE';

    const maskedDrafterId = maskPII(doc.drafterId);
    const verdict: WorkflowVerdict = {
      docId: doc.docId,
      progress,
      status,
      maskedDrafterId,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'DRAFT_DOCUMENT',
      details: { docId: doc.docId, progress, status, maskedDrafterId },
    });
    return verdict;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
