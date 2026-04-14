// Design Ref: §클래스 설계 — SlaAutomationV3
// Plan SC: SVC-AI-ADV-R547

interface SlaContract {
  contractId: string
  serviceId: string
  metric: string
  targetValue: number
  unit: string
}

interface AuditEntry { timestamp: string; action: string; contractId: string; details?: Record<string, unknown> }

export class SlaAutomationV3 {
  private contracts = new Map<string, SlaContract>()
  private actuals = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerContract(contractId: string, serviceId: string, metric: string, targetValue: number, unit: string): SlaContract {
    const contract: SlaContract = { contractId, serviceId, metric, targetValue, unit }
    this.contracts.set(contractId, contract)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_CONTRACT', contractId, details: { serviceId, metric, targetValue, unit } })
    return contract
  }

  recordActual(contractId: string, actualValue: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.contracts.has(contractId)) throw new Error(`계약을 찾을 수 없습니다: ${contractId}`)
    this.actuals.set(contractId, actualValue)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_ACTUAL', contractId, details: { actualValue } })
  }

  getComplianceRate(contractId: string): number {
    const contract = this.contracts.get(contractId)
    if (!contract) throw new Error(`계약을 찾을 수 없습니다: ${contractId}`)
    const actual = this.actuals.get(contractId) ?? 0
    if (contract.targetValue === 0) return 100
    return (actual / contract.targetValue) * 100
  }

  getBreachedSlas(): SlaContract[] {
    return Array.from(this.contracts.values()).filter(c => this.getComplianceRate(c.contractId) < 100)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
