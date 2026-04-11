// 알림 중복 제거 엔진 -- FR-N370.1~FR-N370.4
// Design Ref: MTU-N370 | CSAP: D-06, D-08

export interface AlertEvent { readonly alertId: string; readonly source: string; readonly type: string; readonly message: string; readonly severity: 'info' | 'warning' | 'error' | 'critical'; readonly timestamp: string; readonly fingerprint: string; }
export interface AlertGroup { readonly groupId: string; readonly fingerprint: string; readonly representative: AlertEvent; readonly count: number; readonly firstSeen: string; readonly lastSeen: string; }
export interface DedupResult { readonly totalAlerts: number; readonly uniqueGroups: number; readonly deduplicatedCount: number; readonly groups: readonly AlertGroup[]; }
export interface DedupAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: DedupAuditEntry[] = [];
function recordAudit(entry: Omit<DedupAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getDedupAuditLog(tenantId: string): readonly DedupAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function computeFingerprint(source: string, type: string, message: string): string {
  const normalized = `${source}:${type}:${message.replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim()}`;
  let h = 0;
  for (let i = 0; i < normalized.length; i++) h = ((h << 5) - h + normalized.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0');
}

export function createAlert(source: string, type: string, message: string, severity: AlertEvent['severity']): AlertEvent {
  const fp = computeFingerprint(source, type, message);
  return { alertId: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source, type, message, severity, timestamp: new Date().toISOString(), fingerprint: fp };
}

export function deduplicateAlerts(tenantId: string, alerts: AlertEvent[]): DedupResult {
  const groups = new Map<string, { alerts: AlertEvent[] }>();
  for (const a of alerts) {
    const g = groups.get(a.fingerprint) ?? { alerts: [] };
    g.alerts.push(a);
    groups.set(a.fingerprint, g);
  }
  const result: AlertGroup[] = [];
  for (const [fp, g] of groups.entries()) {
    const sorted = g.alerts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    result.push({ groupId: `ag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fingerprint: fp, representative: sorted[0]!, count: sorted.length, firstSeen: sorted[0]!.timestamp, lastSeen: sorted[sorted.length - 1]!.timestamp });
  }
  const deduped = alerts.length - result.length;
  recordAudit({ actor: 'system', tenantId, action: 'ALERTS_DEDUPLICATED', target: tenantId, details: { total: alerts.length, groups: result.length, deduped } });
  return { totalAlerts: alerts.length, uniqueGroups: result.length, deduplicatedCount: deduped, groups: result };
}

export class AlertDedupEngineService {
  constructor(private readonly tenantId: string) {}
  createAlert(source: string, type: string, msg: string, sev: AlertEvent['severity']): AlertEvent { return createAlert(source, type, msg, sev); }
  deduplicate(alerts: AlertEvent[]): DedupResult { return deduplicateAlerts(this.tenantId, alerts); }
  getAuditLog(): readonly DedupAuditEntry[] { return getDedupAuditLog(this.tenantId); }
}
