// Design Ref: §자동결재 — amount<=1000000&&grade>='3'&&hasAttachments→AUTO
// Plan SC: SC-R565-1, SC-R565-2, SC-R565-3

interface DecisionRequest {
  requestId: string;
  category: string;
  amount: number;
  requesterGrade: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  hasAttachments: boolean;
}

type ApprovalRoute = 'AUTO' | 'FAST_TRACK' | 'STANDARD';

interface DecisionResult {
  requestId: string;
  canAutoApprove: boolean;
  approvalRoute: ApprovalRoute;
  estimatedDays: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  requestId: string;
  approvalRoute: ApprovalRoute;
  canAutoApprove: boolean;
}

export class DecisionAutomationAIV2 {
  private readonly auditLog: AuditEntry[] = [];

  process(input: DecisionRequest): DecisionResult {
    const { requestId, amount, requesterGrade, urgency, hasAttachments } = input;

    const canAutoApprove = amount <= 1_000_000 && requesterGrade >= '3' && hasAttachments;
    const approvalRoute = this.determineRoute(canAutoApprove, urgency);
    const estimatedDays = this.estimateDays(approvalRoute);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'DECISION_PROCESSED',
      requestId,
      approvalRoute,
      canAutoApprove,
    });

    return { requestId, canAutoApprove, approvalRoute, estimatedDays };
  }

  private determineRoute(canAutoApprove: boolean, urgency: 'HIGH' | 'MEDIUM' | 'LOW'): ApprovalRoute {
    if (canAutoApprove) return 'AUTO';
    if (urgency === 'HIGH') return 'FAST_TRACK';
    return 'STANDARD';
  }

  private estimateDays(route: ApprovalRoute): number {
    if (route === 'AUTO') return 0;
    if (route === 'FAST_TRACK') return 1;
    return 3;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
