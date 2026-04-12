// Design Ref: §핵심 알고리즘 — SLA 위험 수준 다차원 계산
// Plan SC: FR-R286.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface SlaDefinition {
  serviceId: string;
  name: string;
  targetResponseTimeMs: number;
  targetAvailability: number;
  targetErrorRate: number;
}

interface SlaMetrics {
  serviceId: string;
  responseTimeMs: number;
  availabilityPercent: number;
  errorRate: number;
  recordedAt: string;
}

interface SlaRiskResult {
  serviceId: string;
  serviceName: string;
  riskLevel: 'safe' | 'warning' | 'critical';
  violations: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R286.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class SlaViolationPreventerAI {
  private slas = new Map<string, SlaDefinition>();
  private metrics = new Map<string, SlaMetrics>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R286.1
  registerSla(serviceId: string, name: string, targetResponseTimeMs: number, targetAvailability: number, targetErrorRate: number): void {
    this.slas.set(serviceId, { serviceId, name, targetResponseTimeMs, targetAvailability, targetErrorRate });
    this.log('REGISTER_SLA', { serviceId, name, targetResponseTimeMs, targetAvailability, targetErrorRate });
  }

  // Plan SC: FR-R286.2
  recordMetrics(serviceId: string, responseTimeMs: number, availabilityPercent: number, errorRate: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.slas.has(serviceId)) throw new Error(`SLA 미등록: ${serviceId}`);
    this.metrics.set(serviceId, { serviceId, responseTimeMs, availabilityPercent, errorRate, recordedAt: new Date().toISOString() });
    this.log('RECORD_METRICS', { serviceId, responseTimeMs, availabilityPercent, errorRate });
  }

  // Plan SC: FR-R286.3
  getRiskLevel(serviceId: string): SlaRiskResult {
    const sla = this.slas.get(serviceId);
    if (!sla) throw new Error(`SLA 미등록: ${serviceId}`);

    const m = this.metrics.get(serviceId);
    if (!m) return { serviceId, serviceName: sla.name, riskLevel: 'safe', violations: [] };

    const violations: string[] = [];
    let maxLevel: 'safe' | 'warning' | 'critical' = 'safe';

    const setLevel = (level: 'warning' | 'critical') => {
      if (level === 'critical' || maxLevel === 'safe') maxLevel = level;
    };

    const rtRatio = m.responseTimeMs / sla.targetResponseTimeMs;
    if (rtRatio > 1.0) { violations.push(`응답시간 초과 (${m.responseTimeMs}ms > ${sla.targetResponseTimeMs}ms)`); setLevel('critical'); }
    else if (rtRatio > 0.9) { violations.push(`응답시간 경고 (${Math.round(rtRatio * 100)}%)`); setLevel('warning'); }

    if (m.availabilityPercent < sla.targetAvailability * 0.95) { violations.push(`가용성 임계 (${m.availabilityPercent}%)`); setLevel('critical'); }
    else if (m.availabilityPercent < sla.targetAvailability * 0.99) { violations.push(`가용성 경고 (${m.availabilityPercent}%)`); setLevel('warning'); }

    if (m.errorRate > sla.targetErrorRate * 1.5) { violations.push(`오류율 임계 (${m.errorRate}%)`); setLevel('critical'); }
    else if (m.errorRate > sla.targetErrorRate * 1.1) { violations.push(`오류율 경고 (${m.errorRate}%)`); setLevel('warning'); }

    return { serviceId, serviceName: sla.name, riskLevel: maxLevel, violations };
  }

  // Plan SC: FR-R286.4
  getAtRiskServices(): SlaRiskResult[] {
    return Array.from(this.slas.keys())
      .map(id => this.getRiskLevel(id))
      .filter(r => r.riskLevel !== 'safe')
      .sort((a, b) => (b.riskLevel === 'critical' ? 1 : 0) - (a.riskLevel === 'critical' ? 1 : 0));
  }

  // Plan SC: FR-R286.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
