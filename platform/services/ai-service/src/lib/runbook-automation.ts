// 운영 런북 자동화 -- FR-N368.1~FR-N368.4
// Design Ref: MTU-N368 | CSAP: D-06, D-08, D-13

export interface RunbookStep { readonly stepId: string; readonly order: number; readonly name: string; readonly command: string; readonly timeout: number; readonly rollbackCommand: string | null; }
export interface Runbook { readonly runbookId: string; readonly tenantId: string; readonly name: string; readonly description: string; readonly steps: readonly RunbookStep[]; readonly createdAt: string; }
export interface RunbookExecution { readonly executionId: string; readonly runbookId: string; readonly status: 'running' | 'completed' | 'failed' | 'rolled_back'; readonly stepResults: readonly StepResult[]; readonly startedAt: string; readonly completedAt: string | null; }
export interface StepResult { readonly stepId: string; readonly name: string; readonly status: 'success' | 'failed' | 'skipped'; readonly output: string; readonly duration: number; }
export interface RunbookAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: RunbookAuditEntry[] = [];
function recordAudit(entry: Omit<RunbookAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getRunbookAuditLog(tenantId: string): readonly RunbookAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const runbookStore: Map<string, Runbook[]> = new Map();

export function defineRunbook(tenantId: string, name: string, description: string, steps: Omit<RunbookStep, 'stepId'>[]): Runbook {
  const rb: Runbook = { runbookId: `rb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, name, description, steps: steps.map((s, i) => ({ ...s, stepId: `step-${i + 1}` })), createdAt: new Date().toISOString() };
  const existing = runbookStore.get(tenantId) ?? [];
  existing.push(rb);
  runbookStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'RUNBOOK_DEFINED', target: rb.runbookId, details: { name, steps: steps.length } });
  return rb;
}

export function executeRunbook(tenantId: string, runbook: Runbook, stepOutcomes: Record<string, boolean>): RunbookExecution {
  const results: StepResult[] = [];
  let failed = false;
  for (const step of runbook.steps) {
    if (failed) { results.push({ stepId: step.stepId, name: step.name, status: 'skipped', output: '이전 단계 실패로 건너뜀', duration: 0 }); continue; }
    const success = stepOutcomes[step.stepId] ?? true;
    const duration = Math.floor(Math.random() * 5000);
    if (success) { results.push({ stepId: step.stepId, name: step.name, status: 'success', output: `${step.name} 완료`, duration }); }
    else { results.push({ stepId: step.stepId, name: step.name, status: 'failed', output: `${step.name} 실패`, duration }); failed = true; }
  }
  const status: RunbookExecution['status'] = failed ? 'failed' : 'completed';
  recordAudit({ actor: 'system', tenantId, action: 'RUNBOOK_EXECUTED', target: runbook.runbookId, details: { status, steps: results.length } });
  return { executionId: `rbe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, runbookId: runbook.runbookId, status, stepResults: results, startedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
}

export class RunbookAutomationService {
  constructor(private readonly tenantId: string) {}
  define(name: string, desc: string, steps: Omit<RunbookStep, 'stepId'>[]): Runbook { return defineRunbook(this.tenantId, name, desc, steps); }
  execute(runbook: Runbook, outcomes: Record<string, boolean>): RunbookExecution { return executeRunbook(this.tenantId, runbook, outcomes); }
  getAuditLog(): readonly RunbookAuditEntry[] { return getRunbookAuditLog(this.tenantId); }
}
