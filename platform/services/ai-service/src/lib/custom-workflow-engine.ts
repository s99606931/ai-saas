// 테넌트 커스텀 워크플로우 엔진 -- FR-N316.1~FR-N316.4
// Design Ref: MTU-N316 | CSAP: D-06, D-08

export type StepType = 'approval' | 'review' | 'notification' | 'condition' | 'action' | 'parallel';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export interface WorkflowStep { readonly stepId: string; readonly name: string; readonly type: StepType; readonly assignee: string; readonly nextSteps: string[]; readonly condition?: string; readonly status: StepStatus; }
export interface WorkflowDefinition { readonly workflowId: string; readonly tenantId: string; readonly name: string; readonly description: string; readonly steps: WorkflowStep[]; readonly createdAt: string; }
export interface WorkflowInstance { readonly instanceId: string; readonly workflowId: string; readonly tenantId: string; readonly currentStepId: string; readonly status: 'active' | 'completed' | 'cancelled'; readonly startedAt: string; readonly completedAt: string | null; readonly stepHistory: Array<{ stepId: string; status: StepStatus; completedAt: string }>; }
export interface WorkflowAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: WorkflowAuditEntry[] = [];
function recordAudit(entry: Omit<WorkflowAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getWorkflowAuditLog(tenantId: string): readonly WorkflowAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const defStore: Map<string, WorkflowDefinition[]> = new Map();
const instStore: Map<string, WorkflowInstance[]> = new Map();

export function defineWorkflow(tenantId: string, name: string, description: string, steps: Omit<WorkflowStep, 'status'>[]): WorkflowDefinition {
  const def: WorkflowDefinition = {
    workflowId: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, name, description,
    steps: steps.map(s => ({ ...s, status: 'pending' as const })), createdAt: new Date().toISOString(),
  };
  const existing = defStore.get(tenantId) ?? [];
  existing.push(def);
  defStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'WORKFLOW_DEFINED', target: def.workflowId, details: { name, stepsCount: steps.length } });
  return def;
}

export function startWorkflow(tenantId: string, workflowId: string): WorkflowInstance {
  const defs = defStore.get(tenantId) ?? [];
  const def = defs.find(d => d.workflowId === workflowId);
  const firstStep = def?.steps[0];
  const inst: WorkflowInstance = {
    instanceId: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, workflowId, tenantId,
    currentStepId: firstStep?.stepId ?? 'unknown', status: 'active',
    startedAt: new Date().toISOString(), completedAt: null, stepHistory: [],
  };
  const existing = instStore.get(tenantId) ?? [];
  existing.push(inst);
  instStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'WORKFLOW_STARTED', target: inst.instanceId, details: { workflowId } });
  return inst;
}

export function completeStep(tenantId: string, instanceId: string, stepId: string): WorkflowInstance | null {
  const instances = instStore.get(tenantId) ?? [];
  const idx = instances.findIndex(i => i.instanceId === instanceId);
  if (idx < 0) return null;
  const inst = instances[idx];
  if (!inst) return null;
  const defs = defStore.get(tenantId) ?? [];
  const def = defs.find(d => d.workflowId === inst.workflowId);
  const currentStep = def?.steps.find(s => s.stepId === stepId);
  const nextStepId = currentStep?.nextSteps[0];
  const nextStep = nextStepId ? def?.steps.find(s => s.stepId === nextStepId) : undefined;
  const updated: WorkflowInstance = {
    ...inst,
    currentStepId: nextStep?.stepId ?? 'done',
    status: nextStep ? 'active' : 'completed',
    completedAt: nextStep ? null : new Date().toISOString(),
    stepHistory: [...inst.stepHistory, { stepId, status: 'completed', completedAt: new Date().toISOString() }],
  };
  instances[idx] = updated;
  recordAudit({ actor: 'system', tenantId, action: 'STEP_COMPLETED', target: instanceId, details: { stepId, nextStepId: nextStep?.stepId ?? 'done' } });
  return updated;
}

export function getWorkflowInstances(tenantId: string): readonly WorkflowInstance[] { return instStore.get(tenantId) ?? []; }

export class CustomWorkflowService {
  constructor(private readonly tenantId: string) {}
  define(name: string, desc: string, steps: Omit<WorkflowStep, 'status'>[]): WorkflowDefinition { return defineWorkflow(this.tenantId, name, desc, steps); }
  start(workflowId: string): WorkflowInstance { return startWorkflow(this.tenantId, workflowId); }
  complete(instanceId: string, stepId: string): WorkflowInstance | null { return completeStep(this.tenantId, instanceId, stepId); }
  getInstances(): readonly WorkflowInstance[] { return getWorkflowInstances(this.tenantId); }
  getAuditLog(): readonly WorkflowAuditEntry[] { return getWorkflowAuditLog(this.tenantId); }
}
