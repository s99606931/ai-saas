// 실시간 결재 추적 AI -- FR-N382.1~FR-N382.5
// Design Ref: MTU-N382 | CSAP: D-06, D-08

export type ApprovalStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'escalated';

export interface ApprovalStep {
  readonly stepId: string;
  readonly approverId: string;
  readonly order: number;
  status: ApprovalStatus;
  startedAt?: number;
  completedAt?: number;
  slaMinutes: number;
}

export interface ApprovalFlow {
  readonly flowId: string;
  readonly documentId: string;
  readonly steps: ApprovalStep[];
  readonly createdAt: number;
}

export interface EscalationRule {
  readonly overdueMinutes: number;
  readonly escalateTo: string;
}

export interface ApprovalAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: ApprovalAuditEntry[] = [];

function recordAudit(entry: Omit<ApprovalAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getApprovalAuditLog(tenantId: string): readonly ApprovalAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function createFlow(flowId: string, documentId: string, steps: Omit<ApprovalStep, 'status'>[]): ApprovalFlow {
  return {
    flowId,
    documentId,
    steps: steps.map((s) => ({ ...s, status: 'pending' as ApprovalStatus })),
    createdAt: Date.now(),
  };
}

export function advanceStep(tenantId: string, flow: ApprovalFlow, stepId: string, approve: boolean): ApprovalFlow {
  const step = flow.steps.find((s) => s.stepId === stepId);
  if (!step) throw new Error(`단계 없음: ${stepId}`);
  step.status = approve ? 'approved' : 'rejected';
  step.completedAt = Date.now();
  recordAudit({
    actor: step.approverId,
    tenantId,
    action: 'STEP_ADVANCED',
    target: stepId,
    details: { status: step.status },
  });
  if (approve) {
    const next = flow.steps.find((s) => s.order === step.order + 1);
    if (next) {
      next.status = 'in_review';
      next.startedAt = Date.now();
    }
  }
  return flow;
}

export function detectDelayedSteps(flow: ApprovalFlow, now: number = Date.now()): readonly ApprovalStep[] {
  return flow.steps.filter((s) => {
    if (s.status !== 'in_review' || !s.startedAt) return false;
    const elapsedMin = (now - s.startedAt) / 60_000;
    return elapsedMin > s.slaMinutes;
  });
}

export function escalateOverdue(
  tenantId: string,
  flow: ApprovalFlow,
  rules: readonly EscalationRule[],
  now: number = Date.now(),
): readonly ApprovalStep[] {
  const delayed = detectDelayedSteps(flow, now);
  const escalated: ApprovalStep[] = [];
  for (const step of delayed) {
    if (!step.startedAt) continue;
    const elapsedMin = (now - step.startedAt) / 60_000;
    const rule = rules.find((r) => elapsedMin >= r.overdueMinutes);
    if (rule) {
      step.status = 'escalated';
      escalated.push(step);
      recordAudit({
        actor: 'system',
        tenantId,
        action: 'STEP_ESCALATED',
        target: step.stepId,
        details: { escalateTo: rule.escalateTo, elapsedMin: Math.round(elapsedMin) },
      });
    }
  }
  return escalated;
}

export function estimateCompletion(flow: ApprovalFlow, now: number = Date.now()): number {
  const pending = flow.steps.filter((s) => s.status === 'pending' || s.status === 'in_review');
  const totalMin = pending.reduce((sum, s) => sum + s.slaMinutes, 0);
  return now + totalMin * 60_000;
}

export class ApprovalTrackingAiService {
  constructor(private readonly tenantId: string) {}
  create(flowId: string, documentId: string, steps: Omit<ApprovalStep, 'status'>[]): ApprovalFlow {
    return createFlow(flowId, documentId, steps);
  }
  advance(flow: ApprovalFlow, stepId: string, approve: boolean): ApprovalFlow {
    return advanceStep(this.tenantId, flow, stepId, approve);
  }
  detectDelayed(flow: ApprovalFlow, now?: number): readonly ApprovalStep[] {
    return detectDelayedSteps(flow, now);
  }
  escalate(flow: ApprovalFlow, rules: readonly EscalationRule[], now?: number): readonly ApprovalStep[] {
    return escalateOverdue(this.tenantId, flow, rules, now);
  }
  estimate(flow: ApprovalFlow, now?: number): number {
    return estimateCompletion(flow, now);
  }
  getAuditLog(): readonly ApprovalAuditEntry[] {
    return getApprovalAuditLog(this.tenantId);
  }
}
