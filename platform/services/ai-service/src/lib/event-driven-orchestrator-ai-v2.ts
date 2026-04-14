// Design Ref: SVC-AI-ADV-R650.design.md — AI기반 이벤트 드리븐 오케스트레이터 v2
// Plan SC: FR-R650.1~5

export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

interface StepDef { stepId: string; expectedMs: number }
interface StepRecord { stepId: string; actualMs: number; status: StepStatus; timestamp: string }
interface Workflow { workflowId: string; steps: StepDef[] }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class EventDrivenOrchestratorAIV2 {
  private workflows = new Map<string, Workflow>();
  private records = new Map<string, StepRecord[]>();
  private auditLog: AuditEntry[] = [];

  defineWorkflow(workflowId: string, steps: StepDef[]): void {
    if (steps.length === 0) throw new Error('EMPTY_STEPS');
    this.workflows.set(workflowId, { workflowId, steps });
    this.records.set(workflowId, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'DEFINE_WORKFLOW',
      details: { workflowId, steps: steps.length },
    });
  }

  handleEvent(workflowId: string, eventName: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (!this.workflows.has(workflowId)) throw new Error(`UNKNOWN_WORKFLOW: ${workflowId}`);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'HANDLE_EVENT',
      details: { workflowId, eventName },
    });
  }

  recordStep(workflowId: string, stepId: string, actualMs: number, status: StepStatus): void {
    const list = this.records.get(workflowId);
    if (!list) throw new Error(`UNKNOWN_WORKFLOW: ${workflowId}`);
    list.push({ stepId, actualMs, status, timestamp: new Date().toISOString() });
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_STEP',
      details: { workflowId, stepId, actualMs, status },
    });
  }

  getDelayedSteps(workflowId: string): Array<{ stepId: string; actualMs: number; expectedMs: number }> {
    const wf = this.workflows.get(workflowId);
    const list = this.records.get(workflowId) ?? [];
    if (!wf) return [];
    const expectMap = new Map(wf.steps.map((s) => [s.stepId, s.expectedMs]));
    const delayed: Array<{ stepId: string; actualMs: number; expectedMs: number }> = [];
    for (const rec of list) {
      const exp = expectMap.get(rec.stepId);
      if (exp !== undefined && rec.actualMs > exp * 1.5) {
        delayed.push({ stepId: rec.stepId, actualMs: rec.actualMs, expectedMs: exp });
      }
    }
    return delayed;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
