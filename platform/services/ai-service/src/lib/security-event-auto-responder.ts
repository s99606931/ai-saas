// Design Ref: §핵심 알고리즘 — 임계값+쿨다운 기반 자동 대응
// Plan SC: FR-R261.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type ResponseAction = 'block' | 'isolate' | 'alert' | 'notify';
type EventSeverity = 'critical' | 'high' | 'medium' | 'low';

interface ResponseRule {
  id: string;
  eventType: string;
  threshold: number;
  windowMs: number;
  action: ResponseAction;
  cooldownMs: number;
}

interface SecurityEvent {
  id: string;
  type: string;
  severity: EventSeverity;
  sourceIp: string;
  timestamp: string;
}

interface ResponseDecision {
  eventId: string;
  eventType: string;
  triggered: boolean;
  action: ResponseAction | null;
  ruleId: string | null;
  reason: string;
}

interface ResponseRecord {
  ruleId: string;
  eventType: string;
  action: ResponseAction;
  triggeredAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R261.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class SecurityEventAutoResponder {
  private rules = new Map<string, ResponseRule>();
  private events: SecurityEvent[] = [];
  private responseHistory: ResponseRecord[] = [];
  private lastResponseTime = new Map<string, number>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R261.1
  registerRule(id: string, eventType: string, threshold: number, action: ResponseAction, cooldownMs: number = 60000, windowMs: number = 300000): void {
    this.rules.set(id, { id, eventType, threshold, windowMs, action, cooldownMs });
    this.log('REGISTER_RULE', { id, eventType, threshold, action, cooldownMs });
  }

  // Plan SC: FR-R261.2
  recordEvent(type: string, severity: EventSeverity, sourceIp: string, grade: DataGrade = DataGrade.O): SecurityEvent {
    guardDataGrade(grade);
    const event: SecurityEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      severity,
      sourceIp,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
    this.log('RECORD_EVENT', { id: event.id, type, severity, sourceIp });
    return event;
  }

  // Plan SC: FR-R261.3
  processEvent(eventId: string): ResponseDecision {
    const event = this.events.find(e => e.id === eventId);
    if (!event) throw new Error(`이벤트 미존재: ${eventId}`);

    const matchingRules = Array.from(this.rules.values()).filter(r => r.eventType === event.type);
    if (matchingRules.length === 0) {
      return { eventId, eventType: event.type, triggered: false, action: null, ruleId: null, reason: '매칭 규칙 없음' };
    }

    const now = Date.now();

    for (const rule of matchingRules) {
      // 쿨다운 체크
      const lastResponse = this.lastResponseTime.get(rule.id) ?? 0;
      if (now - lastResponse < rule.cooldownMs) {
        continue;
      }

      // 윈도우 내 이벤트 수 체크
      const windowStart = now - rule.windowMs;
      const recentCount = this.events.filter(
        e => e.type === rule.eventType && new Date(e.timestamp).getTime() >= windowStart
      ).length;

      if (recentCount >= rule.threshold) {
        this.lastResponseTime.set(rule.id, now);
        const record: ResponseRecord = {
          ruleId: rule.id,
          eventType: event.type,
          action: rule.action,
          triggeredAt: new Date().toISOString(),
        };
        this.responseHistory.push(record);
        this.log('AUTO_RESPONSE_TRIGGERED', { eventId, ruleId: rule.id, action: rule.action });
        return { eventId, eventType: event.type, triggered: true, action: rule.action, ruleId: rule.id, reason: `임계값 초과 (${recentCount}/${rule.threshold})` };
      }
    }

    return { eventId, eventType: event.type, triggered: false, action: null, ruleId: null, reason: '임계값 미달' };
  }

  // Plan SC: FR-R261.4
  getResponseHistory(eventType?: string): ResponseRecord[] {
    if (eventType) {
      return this.responseHistory.filter(r => r.eventType === eventType);
    }
    return [...this.responseHistory];
  }

  // Plan SC: FR-R261.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
