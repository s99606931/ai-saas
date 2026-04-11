// 장애 타임라인 자동 구성 -- FR-N354.1~FR-N354.4
// Design Ref: MTU-N354 | CSAP: D-06, D-08

export interface TimelineEvent { readonly eventId: string; readonly source: string; readonly type: 'alert' | 'log' | 'metric' | 'action' | 'resolution'; readonly description: string; readonly severity: 'info' | 'warning' | 'error' | 'critical'; readonly timestamp: string; readonly metadata: Record<string, unknown>; }
export interface IncidentTimeline { readonly timelineId: string; readonly tenantId: string; readonly incidentId: string; readonly events: readonly TimelineEvent[]; readonly duration: number; readonly rootCauses: readonly string[]; readonly generatedAt: string; }
export interface TimelineAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: TimelineAuditEntry[] = [];
function recordAudit(entry: Omit<TimelineAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getTimelineAuditLog(tenantId: string): readonly TimelineAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function createTimelineEvent(source: string, type: TimelineEvent['type'], description: string, severity: TimelineEvent['severity'], timestamp: string, metadata: Record<string, unknown> = {}): TimelineEvent {
  return { eventId: `te-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source, type, description, severity, timestamp, metadata };
}

export function buildTimeline(tenantId: string, incidentId: string, events: TimelineEvent[]): IncidentTimeline {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let duration = 0;
  if (sorted.length >= 2) {
    const first = new Date(sorted[0]!.timestamp).getTime();
    const last = new Date(sorted[sorted.length - 1]!.timestamp).getTime();
    duration = Math.round((last - first) / 1000);
  }
  const rootCauses: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!;
    if ((e.severity === 'error' || e.severity === 'critical') && i < sorted.length / 2) {
      rootCauses.push(e.description);
    }
  }
  recordAudit({ actor: 'system', tenantId, action: 'TIMELINE_BUILT', target: incidentId, details: { events: sorted.length, duration, rootCauses: rootCauses.length } });
  return { timelineId: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, incidentId, events: sorted, duration, rootCauses: rootCauses.length > 0 ? rootCauses : ['근본 원인 미식별'], generatedAt: new Date().toISOString() };
}

export function correlateEvents(events: TimelineEvent[], windowMs: number = 60000): TimelineEvent[][] {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const groups: TimelineEvent[][] = [];
  let current: TimelineEvent[] = [];
  for (const e of sorted) {
    if (current.length === 0 || new Date(e.timestamp).getTime() - new Date(current[current.length - 1]!.timestamp).getTime() <= windowMs) {
      current.push(e);
    } else {
      if (current.length > 0) groups.push(current);
      current = [e];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

export class IncidentTimelineBuilderService {
  constructor(private readonly tenantId: string) {}
  event(src: string, type: TimelineEvent['type'], desc: string, sev: TimelineEvent['severity'], ts: string, meta?: Record<string, unknown>): TimelineEvent { return createTimelineEvent(src, type, desc, sev, ts, meta); }
  build(incidentId: string, events: TimelineEvent[]): IncidentTimeline { return buildTimeline(this.tenantId, incidentId, events); }
  correlate(events: TimelineEvent[], window?: number): TimelineEvent[][] { return correlateEvents(events, window); }
  getAuditLog(): readonly TimelineAuditEntry[] { return getTimelineAuditLog(this.tenantId); }
}
