// Design Ref: SVC-AI-ADV-R645.design.md §설계결정
// Plan SC: FR-R645.1~5
// 트랙 B 23차

interface IncidentRecord { incidentType: string; severity: 'low' | 'medium' | 'high' | 'critical' }
interface PlaybookStep { order: number; description: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class IncidentPlaybookGeneratorV2 {
  private incidents = new Map<string, IncidentRecord>();
  private steps = new Map<string, PlaybookStep[]>();
  private auditLog: AuditEntry[] = [];

  registerIncident(incidentType: string, severity: IncidentRecord['severity']): void {
    this.incidents.set(incidentType, { incidentType, severity });
    if (!this.steps.has(incidentType)) this.steps.set(incidentType, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_INCIDENT',
      details: { incidentType, severity },
    });
  }

  addStep(incidentType: string, description: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    const list = this.steps.get(incidentType) ?? [];
    list.push({ order: list.length + 1, description });
    this.steps.set(incidentType, list);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_STEP',
      details: { incidentType, order: list.length },
    });
  }

  getStepCount(incidentType: string): number {
    return (this.steps.get(incidentType) ?? []).length;
  }

  getInsufficientPlaybooks(threshold: number): IncidentRecord[] {
    return Array.from(this.incidents.values()).filter(
      (i) => this.getStepCount(i.incidentType) < threshold,
    );
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
