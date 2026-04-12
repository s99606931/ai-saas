// Design Ref: MTU-N94
// Plan SC: FR-N94.1~5

export interface RunbookAutomationConfig { enabled: boolean; namespace: string; version: string; }
export interface RunbookAutomationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface RunbookAutomationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface RunbookAutomationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class RunbookAutomation {
  private rules: RunbookAutomationRule[] = [];
  private events: RunbookAutomationEvent[] = [];
  validateConfig(c: RunbookAutomationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: RunbookAutomationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): RunbookAutomationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: RunbookAutomationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): RunbookAutomationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): RunbookAutomationEvent[] { return [...this.events]; }
}

// ============================================================================
// FR-N368.1~5: defineRunbook / executeRunbook (함수형 API)
// ============================================================================

export interface RunbookStepSpec {
  order: number;
  name: string;
  command: string;
  timeout: number;
  rollbackCommand: string | null;
}

export interface Runbook {
  runbookId: string;
  tenantId: string;
  title: string;
  description: string;
  steps: Array<RunbookStepSpec & { stepId: string }>;
  createdAt: string;
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  message: string;
  at: string;
}

export interface RunbookResult {
  runbookId: string;
  tenantId: string;
  status: 'completed' | 'failed';
  stepResults: StepResult[];
  completedAt: string;
}

interface RunbookAuditEntry {
  tenantId: string;
  runbookId: string;
  action: string;
  at: string;
}

const runbookAuditStore = new Map<string, RunbookAuditEntry[]>();

function pushAudit(tenantId: string, entry: RunbookAuditEntry): void {
  const list = runbookAuditStore.get(tenantId) ?? [];
  list.push(entry);
  runbookAuditStore.set(tenantId, list);
}

export function defineRunbook(
  tenantId: string,
  title: string,
  description: string,
  steps: RunbookStepSpec[],
): Runbook {
  if (!tenantId || !title) throw new Error('tenantId/title required');
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('steps required');
  const runbookId = `rb-${tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const indexedSteps = steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, stepId: `step-${i + 1}` }));
  const rb: Runbook = {
    runbookId,
    tenantId,
    title,
    description,
    steps: indexedSteps,
    createdAt: new Date().toISOString(),
  };
  pushAudit(tenantId, { tenantId, runbookId, action: 'DEFINE', at: rb.createdAt });
  return rb;
}

export function executeRunbook(
  tenantId: string,
  runbook: Runbook,
  stepOutcomes: Record<string, boolean>,
): RunbookResult {
  const results: StepResult[] = [];
  let failed = false;
  for (const step of runbook.steps) {
    if (failed) {
      results.push({
        stepId: step.stepId,
        status: 'skipped',
        message: `이전 단계 실패로 건너뜀: ${step.name}`,
        at: new Date().toISOString(),
      });
      continue;
    }
    const outcome = stepOutcomes[step.stepId];
    const ok = outcome === undefined ? true : outcome;
    if (ok) {
      results.push({
        stepId: step.stepId,
        status: 'success',
        message: `${step.name} 완료`,
        at: new Date().toISOString(),
      });
    } else {
      failed = true;
      results.push({
        stepId: step.stepId,
        status: 'failed',
        message: `${step.name} 실패`,
        at: new Date().toISOString(),
      });
    }
  }
  const result: RunbookResult = {
    runbookId: runbook.runbookId,
    tenantId,
    status: failed ? 'failed' : 'completed',
    stepResults: results,
    completedAt: new Date().toISOString(),
  };
  pushAudit(tenantId, {
    tenantId,
    runbookId: runbook.runbookId,
    action: failed ? 'EXECUTE_FAILED' : 'EXECUTE_COMPLETED',
    at: result.completedAt,
  });
  return result;
}

export function getRunbookAuditLog(tenantId: string): RunbookAuditEntry[] {
  return [...(runbookAuditStore.get(tenantId) ?? [])];
}
