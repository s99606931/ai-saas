// Design Ref: §핵심 알고리즘 — 이벤트 심각도 감점 + 격리 위반 탐지
// Plan SC: FR-R288.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface TenantRecord {
  id: string;
  name: string;
  securityPolicy: string;
}

interface SecurityEvent {
  id: string;
  tenantId: string;
  type: string;
  severity: Severity;
  targetTenantId?: string;
  recordedAt: string;
}

interface IsolationViolation {
  eventId: string;
  sourceTenantId: string;
  targetTenantId: string;
  type: string;
  recordedAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

const SEVERITY_DEDUCTION: Record<Severity, number> = { critical: -20, high: -10, medium: -5, low: -2 };

// Plan SC: FR-R288.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

let eventCounter = 0;

export class MultitenantSecurityAuditorAI {
  private tenants = new Map<string, TenantRecord>();
  private events: SecurityEvent[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R288.1
  registerTenant(id: string, name: string, securityPolicy: string): void {
    this.tenants.set(id, { id, name, securityPolicy });
    this.log('REGISTER_TENANT', { id, name, securityPolicy });
  }

  // Plan SC: FR-R288.2
  recordSecurityEvent(tenantId: string, type: string, severity: Severity, targetTenantId?: string, grade: DataGrade = DataGrade.O): SecurityEvent {
    guardDataGrade(grade);
    if (!this.tenants.has(tenantId)) throw new Error(`테넌트 미등록: ${tenantId}`);
    const event: SecurityEvent = { id: `evt-${++eventCounter}`, tenantId, type, severity, targetTenantId, recordedAt: new Date().toISOString() };
    this.events.push(event);
    this.log('RECORD_SECURITY_EVENT', { tenantId, type, severity, targetTenantId });
    return event;
  }

  // Plan SC: FR-R288.3
  getSecurityScore(tenantId: string): number {
    if (!this.tenants.has(tenantId)) throw new Error(`테넌트 미등록: ${tenantId}`);
    const tenantEvents = this.events.filter(e => e.tenantId === tenantId);
    const deduction = tenantEvents.reduce((s, e) => s + SEVERITY_DEDUCTION[e.severity], 0);
    return Math.max(0, 100 + deduction);
  }

  // Plan SC: FR-R288.4
  getIsolationViolations(): IsolationViolation[] {
    return this.events
      .filter(e => e.targetTenantId && e.targetTenantId !== e.tenantId)
      .map(e => ({
        eventId: e.id,
        sourceTenantId: e.tenantId,
        targetTenantId: e.targetTenantId!,
        type: e.type,
        recordedAt: e.recordedAt,
      }));
  }

  // Plan SC: FR-R288.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
