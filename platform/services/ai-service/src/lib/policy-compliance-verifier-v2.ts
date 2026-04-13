// Plan SC: SVC-AI-ADV-R446
// Design Ref: §준수율공식 — pass 수 / 전체 기록 수 * 100
type ComplianceResult = 'pass' | 'fail' | 'partial'
type DataGrade = 'O' | 'C' | 'S'

interface Policy {
  policyId: string
  name: string
  category: string
  mandatory: boolean
}

interface ComplianceRecord {
  policyId: string
  result: ComplianceResult
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

export class PolicyComplianceVerifierV2 {
  private policies = new Map<string, Policy>()
  private records: ComplianceRecord[] = []
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerPolicy(
    policyId: string,
    name: string,
    category: string,
    mandatory: boolean,
  ): Policy {
    const policy: Policy = { policyId, name, category, mandatory }
    this.policies.set(policyId, policy)
    this.log('policy.register', `policyId=${policyId} mandatory=${mandatory}`)
    return policy
  }

  recordComplianceResult(
    policyId: string,
    result: ComplianceResult,
    dataGrade?: DataGrade,
  ): void {
    this.checkGrade(dataGrade)
    if (!this.policies.has(policyId)) throw new Error('policyId 없음')
    this.records.push({ policyId, result })
    this.log('compliance.record', `policyId=${policyId} result=${result}`)
  }

  getComplianceRate(): number {
    if (this.records.length === 0) return 100
    const passCount = this.records.filter((r) => r.result === 'pass').length
    return (passCount / this.records.length) * 100
  }

  getNonCompliantMandatoryPolicies(): Policy[] {
    const mandatoryPolicies = Array.from(this.policies.values()).filter((p) => p.mandatory)
    return mandatoryPolicies.filter((p) => {
      const policyRecords = this.records.filter((r) => r.policyId === p.policyId)
      if (policyRecords.length === 0) return true
      const latest = policyRecords[policyRecords.length - 1]!
      return latest.result !== 'pass'
    })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
