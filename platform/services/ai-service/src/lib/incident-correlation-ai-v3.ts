// Design Ref: SVC-AI-ADV-R697.design.md — AI기반 장애 상관관계 분석 v3
// Plan SC: FR-R697.1~5

import { createHash } from 'crypto';

export type CorrelationVerdictType = 'ROOT_CAUSE' | 'RELATED' | 'UNRELATED';

interface Incident {
  incidentId: string;
  service: string;
  severity: number;
  openedAt: number;
}
interface RelatedEvent {
  incidentId: string;
  responderId: string;
  eventService: string;
  eventSeverity: number;
  eventAt: number;
}
interface CorrelationVerdict {
  incidentId: string;
  score: number;
  verdict: CorrelationVerdictType;
  maskedResponderId: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class IncidentCorrelationAIV3 {
  private incidents = new Map<string, Incident>();
  private auditLog: AuditEntry[] = [];

  registerIncident(inc: Incident): void {
    if (inc.severity < 1 || inc.severity > 5) {
      throw new Error('INVALID_SEVERITY');
    }
    this.incidents.set(inc.incidentId, inc);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_INCIDENT',
      details: { incidentId: inc.incidentId, service: inc.service, severity: inc.severity },
    });
  }

  addEvent(ev: RelatedEvent, dataGrade?: string): CorrelationVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const inc = this.incidents.get(ev.incidentId);
    if (!inc) {
      throw new Error(`UNKNOWN_INCIDENT: ${ev.incidentId}`);
    }
    if (ev.eventSeverity < 1 || ev.eventSeverity > 5) {
      throw new Error('INVALID_EVENT_SEVERITY');
    }

    const sameService = ev.eventService === inc.service ? 1 : 0;
    const within5min = Math.abs(ev.eventAt - inc.openedAt) <= 5 * 60 * 1000 ? 1 : 0;
    const severityDelta = Math.min(Math.abs(ev.eventSeverity - inc.severity) / 5, 1);
    const score = sameService * 0.5 + within5min * 0.3 + severityDelta * 0.2;

    let verdict: CorrelationVerdictType;
    if (score >= 0.8) verdict = 'ROOT_CAUSE';
    else if (score >= 0.5) verdict = 'RELATED';
    else verdict = 'UNRELATED';

    const maskedResponderId = maskPII(ev.responderId);
    const result: CorrelationVerdict = {
      incidentId: ev.incidentId,
      score,
      verdict,
      maskedResponderId,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_EVENT',
      details: { incidentId: ev.incidentId, score, verdict, maskedResponderId },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
