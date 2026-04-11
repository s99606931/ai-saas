// SLI/SLO 자동 대시보드 -- FR-N322.1~FR-N322.4
// Design Ref: MTU-N322 | CSAP: D-06, D-08

export interface SLODefinition { readonly sloId: string; readonly tenantId: string; readonly serviceName: string; readonly sliName: string; readonly target: number; readonly unit: string; readonly window: 'hourly' | 'daily' | 'weekly' | 'monthly'; }
export interface SLIDataPoint { readonly timestamp: string; readonly value: number; }
export interface SLOStatus { readonly sloId: string; readonly serviceName: string; readonly sliName: string; readonly target: number; readonly current: number; readonly errorBudget: number; readonly errorBudgetRemaining: number; readonly status: 'met' | 'at_risk' | 'violated'; }
export interface SLODashboard { readonly dashboardId: string; readonly tenantId: string; readonly sloStatuses: SLOStatus[]; readonly overallHealth: 'healthy' | 'degraded' | 'critical'; readonly generatedAt: string; }
export interface SLOAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: SLOAuditEntry[] = [];
function recordAudit(entry: Omit<SLOAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getSLOAuditLog(tenantId: string): readonly SLOAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const sloStore: Map<string, SLODefinition[]> = new Map();
const dataStore: Map<string, SLIDataPoint[]> = new Map();

export function defineSLO(tenantId: string, serviceName: string, sliName: string, target: number, unit: string, window: SLODefinition['window'] = 'monthly'): SLODefinition {
  const slo: SLODefinition = { sloId: `slo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, serviceName, sliName, target, unit, window };
  const existing = sloStore.get(tenantId) ?? [];
  existing.push(slo);
  sloStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'SLO_DEFINED', target: slo.sloId, details: { serviceName, sliName, target } });
  return slo;
}

export function recordSLIData(tenantId: string, sloId: string, value: number): SLIDataPoint {
  const point: SLIDataPoint = { timestamp: new Date().toISOString(), value };
  const key = `${tenantId}:${sloId}`;
  const existing = dataStore.get(key) ?? [];
  existing.push(point);
  dataStore.set(key, existing);
  return point;
}

export function calculateSLOStatus(tenantId: string, sloId: string): SLOStatus | null {
  const slos = sloStore.get(tenantId) ?? [];
  const slo = slos.find(s => s.sloId === sloId);
  if (!slo) return null;
  const key = `${tenantId}:${sloId}`;
  const points = dataStore.get(key) ?? [];
  const current = points.length > 0 ? points.reduce((s, p) => s + p.value, 0) / points.length : 0;
  const errorBudget = 100 - slo.target;
  const errorBudgetUsed = Math.max(0, slo.target - current);
  const errorBudgetRemaining = Math.max(0, errorBudget - errorBudgetUsed);
  let status: SLOStatus['status'] = 'met';
  if (current < slo.target - errorBudget) status = 'violated';
  else if (errorBudgetRemaining < errorBudget * 0.2) status = 'at_risk';
  return { sloId, serviceName: slo.serviceName, sliName: slo.sliName, target: slo.target, current, errorBudget, errorBudgetRemaining, status };
}

export function generateDashboard(tenantId: string): SLODashboard {
  const slos = sloStore.get(tenantId) ?? [];
  const statuses: SLOStatus[] = [];
  for (const slo of slos) { const s = calculateSLOStatus(tenantId, slo.sloId); if (s) statuses.push(s); }
  let health: SLODashboard['overallHealth'] = 'healthy';
  if (statuses.some(s => s.status === 'violated')) health = 'critical';
  else if (statuses.some(s => s.status === 'at_risk')) health = 'degraded';
  recordAudit({ actor: 'system', tenantId, action: 'DASHBOARD_GENERATED', target: tenantId, details: { sloCount: statuses.length, health } });
  return { dashboardId: `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, sloStatuses: statuses, overallHealth: health, generatedAt: new Date().toISOString() };
}

export class SLISLODashboardService {
  constructor(private readonly tenantId: string) {}
  define(service: string, sli: string, target: number, unit: string): SLODefinition { return defineSLO(this.tenantId, service, sli, target, unit); }
  record(sloId: string, value: number): SLIDataPoint { return recordSLIData(this.tenantId, sloId, value); }
  status(sloId: string): SLOStatus | null { return calculateSLOStatus(this.tenantId, sloId); }
  dashboard(): SLODashboard { return generateDashboard(this.tenantId); }
  getAuditLog(): readonly SLOAuditEntry[] { return getSLOAuditLog(this.tenantId); }
}
