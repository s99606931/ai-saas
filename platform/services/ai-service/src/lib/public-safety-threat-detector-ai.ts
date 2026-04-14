// Design Ref: §SVC-AI-ADV-R475 — AI기반 공공 안전 위협 자동 탐지
// Plan SC: FR-R475.1~5

export type DataGrade = 'O' | 'C' | 'S';

export interface ThreatEvent {
  readonly eventId: string;
  readonly type: string;
  readonly severity: number;
  readonly location: string;
  readonly timestamp: string;
  readonly grade: DataGrade;
}

export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ThreatResult {
  readonly eventId: string;
  readonly level: ThreatLevel;
  readonly maskedLocation: string;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class PublicSafetyThreatDetector {
  private readonly auditLog: AuditEvent[] = [];

  private maskLocation(location: string): string {
    if (location.length <= 3) return '***';
    return location.slice(0, 3) + '***';
  }

  private classifyLevel(severity: number): ThreatLevel {
    if (severity >= 0.8) return 'CRITICAL';
    if (severity >= 0.6) return 'HIGH';
    if (severity >= 0.4) return 'MEDIUM';
    return 'LOW';
  }

  detect(events: readonly ThreatEvent[]): readonly ThreatResult[] {
    const results: ThreatResult[] = [];

    for (const event of events) {
      if (event.grade === 'C' || event.grade === 'S') {
        this.auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'threat.detect.blocked',
          details: { eventId: event.eventId, grade: event.grade },
        });
        throw new Error(`BLOCKED: ${event.grade}등급 데이터는 처리 금지 (N2SF N-05)`);
      }

      const level = this.classifyLevel(event.severity);
      const maskedLocation = this.maskLocation(event.location);
      results.push({ eventId: event.eventId, level, maskedLocation });
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'threat.detect',
      details: {
        eventCount: events.length,
        criticalCount: results.filter(r => r.level === 'CRITICAL').length,
        highCount: results.filter(r => r.level === 'HIGH').length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
