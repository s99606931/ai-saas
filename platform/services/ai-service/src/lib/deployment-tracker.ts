// 배포 이력 추적/비교 -- FR-N353.1~FR-N353.4
// Design Ref: MTU-N353 | CSAP: D-06, D-08, D-13

export interface Deployment { readonly deploymentId: string; readonly tenantId: string; readonly service: string; readonly version: string; readonly environment: string; readonly status: 'success' | 'failed' | 'rolled_back'; readonly changes: readonly string[]; readonly deployedBy: string; readonly deployedAt: string; }
export interface DeploymentDiff { readonly field: string; readonly oldValue: string; readonly newValue: string; }
export interface DeployAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: DeployAuditEntry[] = [];
function recordAudit(entry: Omit<DeployAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getDeployAuditLog(tenantId: string): readonly DeployAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const deployStore: Map<string, Deployment[]> = new Map();

export function recordDeployment(tenantId: string, service: string, version: string, env: string, changes: string[], deployedBy: string, status: Deployment['status'] = 'success'): Deployment {
  const dep: Deployment = { deploymentId: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, service, version, environment: env, status, changes, deployedBy, deployedAt: new Date().toISOString() };
  const key = `${tenantId}:${service}`;
  const existing = deployStore.get(key) ?? [];
  existing.push(dep);
  deployStore.set(key, existing);
  recordAudit({ actor: deployedBy, tenantId, action: 'DEPLOYMENT_RECORDED', target: dep.deploymentId, details: { service, version, env, status } });
  return dep;
}

export function getDeployments(tenantId: string, service: string): readonly Deployment[] {
  return deployStore.get(`${tenantId}:${service}`) ?? [];
}

export function compareDeployments(a: Deployment, b: Deployment): DeploymentDiff[] {
  const diffs: DeploymentDiff[] = [];
  if (a.version !== b.version) diffs.push({ field: 'version', oldValue: a.version, newValue: b.version });
  if (a.environment !== b.environment) diffs.push({ field: 'environment', oldValue: a.environment, newValue: b.environment });
  if (a.status !== b.status) diffs.push({ field: 'status', oldValue: a.status, newValue: b.status });
  const addedChanges = b.changes.filter(c => !a.changes.includes(c));
  if (addedChanges.length > 0) diffs.push({ field: 'changes', oldValue: `${a.changes.length}건`, newValue: `${b.changes.length}건 (+${addedChanges.length})` });
  return diffs;
}

export function markRollback(tenantId: string, service: string, deploymentId: string): Deployment | null {
  const key = `${tenantId}:${service}`;
  const deps = deployStore.get(key) ?? [];
  const idx = deps.findIndex(d => d.deploymentId === deploymentId);
  if (idx < 0) return null;
  const updated = { ...deps[idx]!, status: 'rolled_back' as const };
  deps[idx] = updated;
  recordAudit({ actor: 'system', tenantId, action: 'DEPLOYMENT_ROLLED_BACK', target: deploymentId, details: { service } });
  return updated;
}

export class DeploymentTrackerService {
  constructor(private readonly tenantId: string) {}
  record(service: string, version: string, env: string, changes: string[], by: string, status?: Deployment['status']): Deployment { return recordDeployment(this.tenantId, service, version, env, changes, by, status); }
  list(service: string): readonly Deployment[] { return getDeployments(this.tenantId, service); }
  compare(a: Deployment, b: Deployment): DeploymentDiff[] { return compareDeployments(a, b); }
  rollback(service: string, depId: string): Deployment | null { return markRollback(this.tenantId, service, depId); }
  getAuditLog(): readonly DeployAuditEntry[] { return getDeployAuditLog(this.tenantId); }
}
