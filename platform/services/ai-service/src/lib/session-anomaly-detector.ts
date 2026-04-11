// 세션 이상 탐지 -- FR-N349.1~FR-N349.4
// Design Ref: MTU-N349 | CSAP: D-06, D-08

export interface SessionEvent { readonly eventId: string; readonly sessionId: string; readonly userId: string; readonly action: string; readonly ipAddress: string; readonly location: string; readonly userAgent: string; readonly timestamp: string; }
export interface SessionAnomaly { readonly anomalyId: string; readonly sessionId: string; readonly userId: string; readonly type: 'location_change' | 'rapid_actions' | 'unusual_time' | 'concurrent_sessions'; readonly description: string; readonly riskScore: number; }
export interface SessionRiskAssessment { readonly userId: string; readonly sessionId: string; readonly totalEvents: number; readonly anomalies: readonly SessionAnomaly[]; readonly overallRisk: 'low' | 'medium' | 'high' | 'critical'; readonly assessedAt: string; }
export interface SessAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: SessAuditEntry[] = [];
function recordAudit(entry: Omit<SessAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getSessionAuditLog(tenantId: string): readonly SessAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function recordSessionEvent(sessionId: string, userId: string, action: string, ip: string, location: string, ua: string): SessionEvent {
  return { eventId: `se-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sessionId, userId, action, ipAddress: ip, location, userAgent: ua, timestamp: new Date().toISOString() };
}

export function detectLocationChange(events: SessionEvent[]): SessionAnomaly[] {
  const anomalies: SessionAnomaly[] = [];
  const locations = new Set(events.map(e => e.location));
  if (locations.size > 1 && events.length > 0) {
    const first = events[0]!;
    anomalies.push({ anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sessionId: first.sessionId, userId: first.userId, type: 'location_change', description: `세션 중 위치 변경 감지: ${[...locations].join(' -> ')}`, riskScore: 80 });
  }
  return anomalies;
}

export function detectRapidActions(events: SessionEvent[], thresholdPerMinute: number = 60): SessionAnomaly[] {
  if (events.length < 2) return [];
  const first = events[0]!;
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const firstTs = new Date(sorted[0]!.timestamp).getTime();
  const lastTs = new Date(sorted[sorted.length - 1]!.timestamp).getTime();
  const durationMin = (lastTs - firstTs) / 60000;
  if (durationMin > 0 && events.length / durationMin > thresholdPerMinute) {
    return [{ anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sessionId: first.sessionId, userId: first.userId, type: 'rapid_actions', description: `비정상 빈도: ${Math.round(events.length / durationMin)}건/분`, riskScore: 70 }];
  }
  return [];
}

export function assessSessionRisk(tenantId: string, sessionId: string, events: SessionEvent[]): SessionRiskAssessment {
  const anomalies: SessionAnomaly[] = [...detectLocationChange(events), ...detectRapidActions(events)];
  const maxRisk = anomalies.length > 0 ? Math.max(...anomalies.map(a => a.riskScore)) : 0;
  let risk: SessionRiskAssessment['overallRisk'] = 'low';
  if (maxRisk >= 90) risk = 'critical';
  else if (maxRisk >= 70) risk = 'high';
  else if (maxRisk >= 40) risk = 'medium';
  const userId = events[0]?.userId ?? 'unknown';
  recordAudit({ actor: 'system', tenantId, action: 'SESSION_RISK_ASSESSED', target: sessionId, details: { events: events.length, anomalies: anomalies.length, risk } });
  return { userId, sessionId, totalEvents: events.length, anomalies, overallRisk: risk, assessedAt: new Date().toISOString() };
}

export class SessionAnomalyDetectorService {
  constructor(private readonly tenantId: string) {}
  record(sid: string, uid: string, action: string, ip: string, loc: string, ua: string): SessionEvent { return recordSessionEvent(sid, uid, action, ip, loc, ua); }
  assess(sessionId: string, events: SessionEvent[]): SessionRiskAssessment { return assessSessionRisk(this.tenantId, sessionId, events); }
  getAuditLog(): readonly SessAuditEntry[] { return getSessionAuditLog(this.tenantId); }
}
