// Design Ref: §컴포넌트 설계 — 실시간 규칙 평가 + 위반 탐지
// Plan SC: FR-R215.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ComplianceRule {
  id: string;
  name: string;
  eventType: string;
  conditionKey: string;
  conditionValue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface ComplianceEvent {
  serviceId: string;
  eventType: string;
  data: Record<string, string>;
  timestamp: string;
}

interface Violation {
  ruleId: string;
  ruleName: string;
  serviceId: string;
  eventType: string;
  severity: string;
  timestamp: string;
}

interface ComplianceResult {
  serviceId: string;
  totalEvents: number;
  violations: Violation[];
  complianceRate: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R215.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class RealtimeComplianceMonitor {
  private rules = new Map<string, ComplianceRule>();
  private events: ComplianceEvent[] = [];
  private violations: Violation[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R215.1
  registerRule(
    id: string,
    name: string,
    eventType: string,
    conditionKey: string,
    conditionValue: string,
    severity: 'critical' | 'high' | 'medium' | 'low' = 'medium'
  ): void {
    this.rules.set(id, { id, name, eventType, conditionKey, conditionValue, severity });
    this.log('REGISTER_RULE', { id, name, eventType, severity });
  }

  // Plan SC: FR-R215.2
  recordEvent(serviceId: string, eventType: string, data: Record<string, string>, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);

    const event: ComplianceEvent = {
      serviceId,
      eventType,
      data,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
    this.evaluateRules(event);
    this.log('RECORD_EVENT', { serviceId, eventType });
  }

  // Plan SC: FR-R215.3
  private evaluateRules(event: ComplianceEvent): void {
    for (const rule of this.rules.values()) {
      if (rule.eventType !== event.eventType) continue;
      const actualValue = event.data[rule.conditionKey];
      if (actualValue === rule.conditionValue) {
        const violation: Violation = {
          ruleId: rule.id,
          ruleName: rule.name,
          serviceId: event.serviceId,
          eventType: event.eventType,
          severity: rule.severity,
          timestamp: event.timestamp,
        };
        this.violations.push(violation);
        this.log('VIOLATION_DETECTED', { ruleId: rule.id, serviceId: event.serviceId, severity: rule.severity });
      }
    }
  }

  // Plan SC: FR-R215.4
  checkCompliance(serviceId: string): ComplianceResult {
    const serviceEvents = this.events.filter(e => e.serviceId === serviceId);
    const serviceViolations = this.violations.filter(v => v.serviceId === serviceId);
    const complianceRate = serviceEvents.length === 0
      ? 100
      : Math.round((1 - serviceViolations.length / serviceEvents.length) * 100);

    return {
      serviceId,
      totalEvents: serviceEvents.length,
      violations: serviceViolations,
      complianceRate,
    };
  }

  getViolations(serviceId?: string): Violation[] {
    if (serviceId) {
      return this.violations.filter(v => v.serviceId === serviceId);
    }
    return [...this.violations];
  }

  // Plan SC: FR-R215.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
