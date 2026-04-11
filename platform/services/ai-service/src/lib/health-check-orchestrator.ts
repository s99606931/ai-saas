// 다계층 헬스체크 오케스트레이터 -- FR-N339.1~FR-N339.4
// Design Ref: MTU-N339 | CSAP: D-06, D-08

export interface HealthTarget { readonly targetId: string; readonly tenantId: string; readonly name: string; readonly type: 'service' | 'database' | 'cache' | 'queue' | 'storage'; readonly endpoint: string; readonly intervalSeconds: number; }
export interface HealthCheckResult { readonly targetId: string; readonly name: string; readonly status: 'healthy' | 'degraded' | 'unhealthy'; readonly responseTimeMs: number; readonly checkedAt: string; readonly detail: string; }
export interface HealthReport { readonly reportId: string; readonly tenantId: string; readonly results: readonly HealthCheckResult[]; readonly overallStatus: 'healthy' | 'degraded' | 'unhealthy'; readonly healthyCount: number; readonly unhealthyCount: number; readonly generatedAt: string; }
export interface HealthAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: HealthAuditEntry[] = [];
function recordAudit(entry: Omit<HealthAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getHealthAuditLog(tenantId: string): readonly HealthAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const targetStore: Map<string, HealthTarget[]> = new Map();

export function registerTarget(tenantId: string, name: string, type: HealthTarget['type'], endpoint: string, intervalSeconds: number = 30): HealthTarget {
  const target: HealthTarget = { targetId: `ht-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, name, type, endpoint, intervalSeconds };
  const existing = targetStore.get(tenantId) ?? [];
  existing.push(target);
  targetStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'HEALTH_TARGET_REGISTERED', target: target.targetId, details: { name, type, endpoint } });
  return target;
}

export function getTargets(tenantId: string): readonly HealthTarget[] { return targetStore.get(tenantId) ?? []; }

export function simulateCheck(target: HealthTarget, responseTimeMs: number, success: boolean): HealthCheckResult {
  let status: HealthCheckResult['status'] = 'healthy';
  if (!success) status = 'unhealthy';
  else if (responseTimeMs > 1000) status = 'degraded';
  return { targetId: target.targetId, name: target.name, status, responseTimeMs, checkedAt: new Date().toISOString(), detail: success ? `${target.name} 응답 정상 (${responseTimeMs}ms)` : `${target.name} 응답 실패` };
}

export function generateHealthReport(tenantId: string, results: HealthCheckResult[]): HealthReport {
  const healthy = results.filter(r => r.status === 'healthy').length;
  const unhealthy = results.filter(r => r.status === 'unhealthy').length;
  let overall: HealthReport['overallStatus'] = 'healthy';
  if (unhealthy > 0) overall = 'unhealthy';
  else if (results.some(r => r.status === 'degraded')) overall = 'degraded';
  recordAudit({ actor: 'system', tenantId, action: 'HEALTH_REPORT_GENERATED', target: tenantId, details: { total: results.length, healthy, unhealthy, overall } });
  return { reportId: `hr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, results, overallStatus: overall, healthyCount: healthy, unhealthyCount: unhealthy, generatedAt: new Date().toISOString() };
}

export class HealthCheckOrchestratorService {
  constructor(private readonly tenantId: string) {}
  register(name: string, type: HealthTarget['type'], endpoint: string, interval?: number): HealthTarget { return registerTarget(this.tenantId, name, type, endpoint, interval); }
  targets(): readonly HealthTarget[] { return getTargets(this.tenantId); }
  check(target: HealthTarget, ms: number, success: boolean): HealthCheckResult { return simulateCheck(target, ms, success); }
  report(results: HealthCheckResult[]): HealthReport { return generateHealthReport(this.tenantId, results); }
  getAuditLog(): readonly HealthAuditEntry[] { return getHealthAuditLog(this.tenantId); }
}
