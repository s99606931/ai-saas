// 인프라 드리프트 탐지 -- FR-N324.1~FR-N324.4
// Design Ref: MTU-N324 | CSAP: D-06, D-13

export interface InfraResource { readonly resourceId: string; readonly type: string; readonly name: string; readonly desiredState: Record<string, unknown>; readonly actualState: Record<string, unknown>; }
export interface DriftResult { readonly driftId: string; readonly resourceId: string; readonly resourceType: string; readonly resourceName: string; readonly property: string; readonly desiredValue: unknown; readonly actualValue: unknown; readonly severity: 'critical' | 'high' | 'medium' | 'low'; readonly detectedAt: string; }
export interface DriftReport { readonly reportId: string; readonly tenantId: string; readonly totalResources: number; readonly driftedResources: number; readonly drifts: DriftResult[]; readonly complianceRate: number; readonly generatedAt: string; }
export interface DriftAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: DriftAuditEntry[] = [];
function recordAudit(entry: Omit<DriftAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getDriftAuditLog(tenantId: string): readonly DriftAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const CRITICAL_PROPERTIES = ['security_group', 'encryption', 'access_control', 'network_policy', 'tls_version'];

export function detectDrift(resource: InfraResource): DriftResult[] {
  const drifts: DriftResult[] = [];
  for (const [key, desired] of Object.entries(resource.desiredState)) {
    const actual = resource.actualState[key];
    if (JSON.stringify(desired) !== JSON.stringify(actual)) {
      const isCritical = CRITICAL_PROPERTIES.some(cp => key.includes(cp));
      drifts.push({ driftId: `drift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, resourceId: resource.resourceId, resourceType: resource.type, resourceName: resource.name, property: key, desiredValue: desired, actualValue: actual, severity: isCritical ? 'critical' : 'medium', detectedAt: new Date().toISOString() });
    }
  }
  return drifts;
}

export function scanInfrastructure(tenantId: string, resources: InfraResource[]): DriftReport {
  const allDrifts: DriftResult[] = [];
  const driftedIds = new Set<string>();
  for (const resource of resources) {
    const drifts = detectDrift(resource);
    if (drifts.length > 0) { driftedIds.add(resource.resourceId); allDrifts.push(...drifts); }
  }
  const complianceRate = resources.length > 0 ? (resources.length - driftedIds.size) / resources.length : 1;
  recordAudit({ actor: 'system', tenantId, action: 'DRIFT_SCAN_COMPLETED', target: tenantId, details: { totalResources: resources.length, drifted: driftedIds.size, drifts: allDrifts.length } });
  return { reportId: `drift-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, totalResources: resources.length, driftedResources: driftedIds.size, drifts: allDrifts, complianceRate, generatedAt: new Date().toISOString() };
}

export class InfraDriftDetectorService {
  constructor(private readonly tenantId: string) {}
  detect(resource: InfraResource): DriftResult[] { return detectDrift(resource); }
  scan(resources: InfraResource[]): DriftReport { return scanInfrastructure(this.tenantId, resources); }
  getAuditLog(): readonly DriftAuditEntry[] { return getDriftAuditLog(this.tenantId); }
}
