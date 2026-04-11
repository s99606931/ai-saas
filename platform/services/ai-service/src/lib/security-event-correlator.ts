// 보안 이벤트 상관 분석 -- FR-N365.1~FR-N365.4
// Design Ref: MTU-N365 | CSAP: D-06, D-08

export interface SecurityEvent { readonly eventId: string; readonly source: string; readonly type: string; readonly severity: 'low' | 'medium' | 'high' | 'critical'; readonly description: string; readonly ip: string; readonly timestamp: string; }
export interface CorrelationRule { readonly ruleId: string; readonly name: string; readonly eventTypes: readonly string[]; readonly windowSeconds: number; readonly threshold: number; readonly threatName: string; }
export interface ThreatDetection { readonly detectionId: string; readonly threatName: string; readonly events: readonly SecurityEvent[]; readonly ruleId: string; readonly severity: string; readonly detectedAt: string; }
export interface SecCorAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: SecCorAuditEntry[] = [];
function recordAudit(entry: Omit<SecCorAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getSecCorAuditLog(tenantId: string): readonly SecCorAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const ruleStore: CorrelationRule[] = [];

export function defineCorrelationRule(name: string, eventTypes: string[], windowSeconds: number, threshold: number, threatName: string): CorrelationRule {
  const rule: CorrelationRule = { ruleId: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, eventTypes, windowSeconds, threshold, threatName };
  ruleStore.push(rule);
  return rule;
}

export function correlateEvents(tenantId: string, events: SecurityEvent[]): ThreatDetection[] {
  const detections: ThreatDetection[] = [];
  for (const rule of ruleStore) {
    const matching = events.filter(e => rule.eventTypes.includes(e.type));
    if (matching.length < rule.threshold) continue;
    const sorted = [...matching].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i <= sorted.length - rule.threshold; i++) {
      const start = sorted[i]!;
      const window = sorted.filter(e => new Date(e.timestamp).getTime() - new Date(start.timestamp).getTime() <= rule.windowSeconds * 1000);
      if (window.length >= rule.threshold) {
        detections.push({ detectionId: `td-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, threatName: rule.threatName, events: window, ruleId: rule.ruleId, severity: 'high', detectedAt: new Date().toISOString() });
        break;
      }
    }
  }
  if (detections.length > 0) {
    recordAudit({ actor: 'system', tenantId, action: 'THREATS_DETECTED', target: tenantId, details: { threats: detections.length, events: events.length } });
  }
  return detections;
}

export class SecurityEventCorrelatorService {
  constructor(private readonly tenantId: string) {}
  defineRule(name: string, types: string[], window: number, threshold: number, threat: string): CorrelationRule { return defineCorrelationRule(name, types, window, threshold, threat); }
  correlate(events: SecurityEvent[]): ThreatDetection[] { return correlateEvents(this.tenantId, events); }
  getAuditLog(): readonly SecCorAuditEntry[] { return getSecCorAuditLog(this.tenantId); }
}
