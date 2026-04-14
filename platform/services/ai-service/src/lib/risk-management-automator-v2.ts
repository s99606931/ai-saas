// Design Ref: §설계결정 — AI기반 공공기관 위험 관리 자동화 v2
// Plan SC: FR-R576.1~5

interface RiskItem { riskId: string; name: string; category: string }
interface RiskAssessment { likelihood: number; impact: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class RiskManagementAutomatorV2 {
  private risks = new Map<string, RiskItem>()
  private assessments = new Map<string, RiskAssessment>()
  private auditLog: AuditEntry[] = []

  registerRisk(riskId: string, name: string, category: string): void {
    this.risks.set(riskId, { riskId, name, category })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_RISK', details: { riskId, name } })
  }

  recordAssessment(riskId: string, likelihood: number, impact: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.assessments.set(riskId, { likelihood, impact })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_ASSESSMENT', details: { riskId, likelihood, impact } })
  }

  getRiskScore(riskId: string): number {
    const a = this.assessments.get(riskId)
    if (!a) return 0
    return a.likelihood * a.impact
  }

  getHighRisks(): RiskItem[] {
    return Array.from(this.risks.values()).filter(r => this.getRiskScore(r.riskId) >= 15)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
