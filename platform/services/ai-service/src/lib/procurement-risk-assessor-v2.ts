// Design Ref: §설계결정 — AI기반 공공기관 조달 위험 평가 v2
// Plan SC: FR-R599.1~5

interface ProcurementItem { procurementId: string; name: string; category: string; contractValue: number }
interface RiskAssessment { vendorRisk: number; deliveryRisk: number; complianceRisk: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ProcurementRiskAssessorV2 {
  private procurements = new Map<string, ProcurementItem>()
  private assessments = new Map<string, RiskAssessment>()
  private auditLog: AuditEntry[] = []

  registerProcurement(procurementId: string, name: string, category: string, contractValue: number): void {
    this.procurements.set(procurementId, { procurementId, name, category, contractValue })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_PROCUREMENT', details: { procurementId, name, contractValue } })
  }

  recordAssessment(procurementId: string, vendorRisk: number, deliveryRisk: number, complianceRisk: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.assessments.set(procurementId, { vendorRisk, deliveryRisk, complianceRisk })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_ASSESSMENT', details: { procurementId, vendorRisk, deliveryRisk, complianceRisk } })
  }

  getOverallRisk(procurementId: string): number {
    const a = this.assessments.get(procurementId)
    if (!a) return 0
    return (a.vendorRisk + a.deliveryRisk + a.complianceRisk) / 3
  }

  getHighRiskProcurements(): ProcurementItem[] {
    return Array.from(this.procurements.values()).filter(p => this.getOverallRisk(p.procurementId) >= 7)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
