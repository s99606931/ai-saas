// 테넌트 사용 패턴 분석 -- FR-N345.1~FR-N345.4
// Design Ref: MTU-N345 | CSAP: D-06, D-08

export interface UsageEvent { readonly eventId: string; readonly tenantId: string; readonly userId: string; readonly feature: string; readonly action: string; readonly timestamp: string; }
export interface UsageSummary { readonly tenantId: string; readonly period: string; readonly totalEvents: number; readonly uniqueUsers: number; readonly topFeatures: readonly { feature: string; count: number }[]; readonly generatedAt: string; }
export interface UsageAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: UsageAuditEntry[] = [];
function recordAudit(entry: Omit<UsageAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getUsageAuditLog(tenantId: string): readonly UsageAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const eventStore: Map<string, UsageEvent[]> = new Map();

export function recordEvent(tenantId: string, userId: string, feature: string, action: string): UsageEvent {
  const event: UsageEvent = { eventId: `ue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, userId, feature, action, timestamp: new Date().toISOString() };
  const existing = eventStore.get(tenantId) ?? [];
  existing.push(event);
  eventStore.set(tenantId, existing);
  return event;
}

export function aggregateUsage(tenantId: string, period: string): UsageSummary {
  const events = eventStore.get(tenantId) ?? [];
  const users = new Set(events.map(e => e.userId));
  const featureCounts = new Map<string, number>();
  for (const e of events) { featureCounts.set(e.feature, (featureCounts.get(e.feature) ?? 0) + 1); }
  const topFeatures = [...featureCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([feature, count]) => ({ feature, count }));
  recordAudit({ actor: 'system', tenantId, action: 'USAGE_AGGREGATED', target: tenantId, details: { period, events: events.length, users: users.size } });
  return { tenantId, period, totalEvents: events.length, uniqueUsers: users.size, topFeatures, generatedAt: new Date().toISOString() };
}

export class TenantUsageAnalyticsService {
  constructor(private readonly tenantId: string) {}
  record(userId: string, feature: string, action: string): UsageEvent { return recordEvent(this.tenantId, userId, feature, action); }
  aggregate(period: string): UsageSummary { return aggregateUsage(this.tenantId, period); }
  getAuditLog(): readonly UsageAuditEntry[] { return getUsageAuditLog(this.tenantId); }
}
