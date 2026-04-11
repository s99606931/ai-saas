// 피처 토글/실험 엔진 -- FR-N346.1~FR-N346.4
// Design Ref: MTU-N346 | CSAP: D-06, D-08

export interface FeatureFlag { readonly flagId: string; readonly tenantId: string; readonly name: string; readonly enabled: boolean; readonly targetRules: readonly TargetRule[]; readonly createdAt: string; }
export interface TargetRule { readonly ruleId: string; readonly attribute: string; readonly operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt'; readonly value: string; }
export interface FlagEvaluation { readonly flagId: string; readonly name: string; readonly enabled: boolean; readonly matchedRule: string | null; }
export interface Experiment { readonly experimentId: string; readonly tenantId: string; readonly name: string; readonly variants: readonly string[]; readonly allocation: Record<string, number>; readonly status: 'running' | 'completed' | 'paused'; }
export interface ToggleAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ToggleAuditEntry[] = [];
function recordAudit(entry: Omit<ToggleAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getToggleAuditLog(tenantId: string): readonly ToggleAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const flagStore: Map<string, FeatureFlag[]> = new Map();
const experimentStore: Map<string, Experiment[]> = new Map();

export function createFlag(tenantId: string, name: string, enabled: boolean = false, rules: TargetRule[] = []): FeatureFlag {
  const flag: FeatureFlag = { flagId: `ff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, name, enabled, targetRules: rules, createdAt: new Date().toISOString() };
  const existing = flagStore.get(tenantId) ?? [];
  existing.push(flag);
  flagStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'FLAG_CREATED', target: flag.flagId, details: { name, enabled } });
  return flag;
}

export function evaluateFlag(flag: FeatureFlag, context: Record<string, string>): FlagEvaluation {
  if (!flag.enabled) return { flagId: flag.flagId, name: flag.name, enabled: false, matchedRule: null };
  for (const rule of flag.targetRules) {
    const val = context[rule.attribute];
    let match = false;
    switch (rule.operator) {
      case 'eq': match = val === rule.value; break;
      case 'neq': match = val !== rule.value; break;
      case 'in': match = rule.value.split(',').includes(val ?? ''); break;
      case 'gt': match = Number(val) > Number(rule.value); break;
      case 'lt': match = Number(val) < Number(rule.value); break;
    }
    if (match) return { flagId: flag.flagId, name: flag.name, enabled: true, matchedRule: rule.ruleId };
  }
  return { flagId: flag.flagId, name: flag.name, enabled: flag.targetRules.length === 0, matchedRule: null };
}

export function createExperiment(tenantId: string, name: string, variants: string[], allocation: Record<string, number>): Experiment {
  const exp: Experiment = { experimentId: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, name, variants, allocation, status: 'running' };
  const existing = experimentStore.get(tenantId) ?? [];
  existing.push(exp);
  experimentStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'EXPERIMENT_CREATED', target: exp.experimentId, details: { name, variants } });
  return exp;
}

export function assignVariant(experiment: Experiment, userId: string): string {
  let hash = 0;
  const key = experiment.experimentId + userId;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  const bucket = Math.abs(hash) % 100;
  let cumulative = 0;
  for (const [variant, pct] of Object.entries(experiment.allocation)) {
    cumulative += pct;
    if (bucket < cumulative) return variant;
  }
  return experiment.variants[0] ?? 'control';
}

export class FeatureToggleEngineService {
  constructor(private readonly tenantId: string) {}
  createFlag(name: string, enabled?: boolean, rules?: TargetRule[]): FeatureFlag { return createFlag(this.tenantId, name, enabled, rules); }
  evaluate(flag: FeatureFlag, ctx: Record<string, string>): FlagEvaluation { return evaluateFlag(flag, ctx); }
  createExperiment(name: string, variants: string[], alloc: Record<string, number>): Experiment { return createExperiment(this.tenantId, name, variants, alloc); }
  assign(exp: Experiment, userId: string): string { return assignVariant(exp, userId); }
  getAuditLog(): readonly ToggleAuditEntry[] { return getToggleAuditLog(this.tenantId); }
}
