// Design Ref: §클래스 설계 — RealtimeApiContractValidatorV2
// Plan SC: SVC-AI-ADV-R532

interface ContractField {
  name: string
  type: string
}

interface ApiContract {
  contractId: string
  apiPath: string
  expectedFields: ContractField[]
}

interface ValidationResult {
  valid: boolean
  violations: string[]
}

interface ViolationStats {
  total: number
  violations: number
}

interface AuditEntry {
  timestamp: string
  action: string
  contractId: string
  details?: Record<string, unknown>
}

export class RealtimeApiContractValidatorV2 {
  private contracts = new Map<string, ApiContract>()
  private stats = new Map<string, ViolationStats>()
  private auditLog: AuditEntry[] = []

  registerContract(contractId: string, apiPath: string, expectedFields: ContractField[]): ApiContract {
    const contract: ApiContract = { contractId, apiPath, expectedFields }
    this.contracts.set(contractId, contract)
    this.stats.set(contractId, { total: 0, violations: 0 })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_CONTRACT', contractId, details: { apiPath, fieldCount: expectedFields.length } })
    return contract
  }

  validateResponse(contractId: string, response: Record<string, unknown>, dataGrade?: string): ValidationResult {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    const contract = this.contracts.get(contractId)
    if (!contract) throw new Error(`계약을 찾을 수 없습니다: ${contractId}`)

    const violations: string[] = []
    for (const field of contract.expectedFields) {
      if (response[field.name] === undefined || response[field.name] === null) {
        violations.push(`필드 누락: ${field.name}`)
      } else if (typeof response[field.name] !== field.type) {
        violations.push(`타입 불일치: ${field.name}`)
      }
    }

    const stat = this.stats.get(contractId)!
    stat.total++
    if (violations.length > 0) stat.violations++

    const result: ValidationResult = { valid: violations.length === 0, violations }
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'VALIDATE_RESPONSE', contractId, details: { valid: result.valid, violationCount: violations.length } })
    return result
  }

  getViolationStats(contractId: string): ViolationStats {
    return this.stats.get(contractId) ?? { total: 0, violations: 0 }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
