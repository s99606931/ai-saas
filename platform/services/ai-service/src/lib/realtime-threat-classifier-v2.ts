// Design Ref: §SVC-AI-ADV-R513 — AI기반 실시간 위협 분류기 v2
// Plan SC: FR-R513.1~5

export type DataGrade = 'O' | 'C' | 'S';
export type ThreatType = 'SQL_INJECTION' | 'XSS' | 'BRUTE_FORCE' | 'DDOS' | 'UNKNOWN';
export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface SecurityEvent {
  readonly eventId: string;
  readonly source: string;
  readonly eventType: string;
  readonly payload: string;
  readonly grade: DataGrade;
}

export interface ThreatClassification {
  readonly eventId: string;
  readonly threatType: ThreatType;
  readonly severity: ThreatSeverity;
  readonly response: string;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

const SQL_PATTERNS = ['SELECT', 'UNION', 'DROP', "'"];
const XSS_PATTERNS = ['<script', 'onerror', 'javascript:'];
const BRUTE_PATTERNS = ['login', 'password', 'attempt'];
const DDOS_PATTERNS = ['flood', 'ddos', 'amplification'];

export class RealtimeThreatClassifierV2 {
  private readonly auditLog: AuditEvent[] = [];

  private classifyThreat(payload: string): { type: ThreatType; severity: ThreatSeverity } {
    const lower = payload.toLowerCase();
    if (SQL_PATTERNS.some(p => payload.includes(p))) {
      return { type: 'SQL_INJECTION', severity: 'CRITICAL' };
    }
    if (XSS_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
      return { type: 'XSS', severity: 'HIGH' };
    }
    if (BRUTE_PATTERNS.some(p => lower.includes(p))) {
      return { type: 'BRUTE_FORCE', severity: 'HIGH' };
    }
    if (DDOS_PATTERNS.some(p => lower.includes(p))) {
      return { type: 'DDOS', severity: 'CRITICAL' };
    }
    return { type: 'UNKNOWN', severity: 'MEDIUM' };
  }

  private getResponse(severity: ThreatSeverity): string {
    if (severity === 'CRITICAL') return 'BLOCK_AND_ALERT';
    if (severity === 'HIGH') return 'BLOCK';
    return 'LOG_AND_MONITOR';
  }

  classify(events: readonly SecurityEvent[]): readonly ThreatClassification[] {
    const results: ThreatClassification[] = [];

    for (const event of events) {
      if (event.grade === 'C' || event.grade === 'S') {
        this.auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'threat.classify.blocked',
          details: { eventId: event.eventId, grade: event.grade },
        });
        throw new Error(`BLOCKED: ${event.grade}등급 보안 이벤트 처리 금지 (N2SF N-05)`);
      }

      const { type, severity } = this.classifyThreat(event.payload);
      const response = this.getResponse(severity);
      results.push({ eventId: event.eventId, threatType: type, severity, response });
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'threat.classify',
      details: {
        eventCount: events.length,
        criticalCount: results.filter(r => r.severity === 'CRITICAL').length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
