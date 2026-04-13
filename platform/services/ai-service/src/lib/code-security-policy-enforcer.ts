// Design Ref: §핵심 알고리즘 — 보안 점수 계산, 위반 분류
// Plan SC: SVC-AI-ADV-R328
export type DataGrade = 'O' | 'C' | 'S'
export type Severity = 'critical' | 'high' | 'medium' | 'low'

const SEVERITY_DEDUCTION: Record<Severity, number> = {
  critical: 30,
  high: 15,
  medium: 7,
  low: 2,
}

export interface SecurityPolicy {
  id: string
  name: string
  ruleType: string
  severity: Severity
}

export interface ViolationInput {
  ruleType: string
  line: number
}

export interface PolicyViolation {
  scanId: string
  policyId: string
  ruleType: string
  severity: Severity
  line: number
}

export interface ScanResult {
  scanId: string
  fileName: string
  securityScore: number
  violations: PolicyViolation[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class CodeSecurityPolicyEnforcer {
  private policies = new Map<string, SecurityPolicy>()
  private scans = new Map<string, ScanResult>()
  private auditLog: AuditEntry[] = []

  registerPolicy(id: string, name: string, ruleType: string, severity: Severity): void {
    if (!id || !name || !ruleType) throw new Error('id, name, ruleType은 필수')
    this.policies.set(id, { id, name, ruleType, severity })
    this.auditLog.push({ action: 'policy.register', timestamp: new Date().toISOString(), detail: id })
  }

  scanCode(scanId: string, fileName: string, violations: ViolationInput[], grade: DataGrade = 'O'): ScanResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 코드 스캔 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!scanId || !fileName) throw new Error('scanId와 fileName은 필수')

    const policyViolations: PolicyViolation[] = []
    let totalDeduction = 0

    for (const v of violations) {
      const matchedPolicy = [...this.policies.values()].find((p) => p.ruleType === v.ruleType)
      const policyId = matchedPolicy?.id ?? 'unknown'
      const severity: Severity = matchedPolicy?.severity ?? 'low'
      policyViolations.push({ scanId, policyId, ruleType: v.ruleType, severity, line: v.line })
      totalDeduction += SEVERITY_DEDUCTION[severity]
    }

    const securityScore = Math.max(0, 100 - totalDeduction)
    const result: ScanResult = { scanId, fileName, securityScore, violations: policyViolations }
    this.scans.set(scanId, result)
    this.auditLog.push({ action: 'code.scan', timestamp: new Date().toISOString(), detail: `${scanId}:score=${securityScore}` })
    return result
  }

  getSecurityScore(scanId: string): number {
    const scan = this.scans.get(scanId)
    if (!scan) throw new Error(`scanId 없음: ${scanId}`)
    return scan.securityScore
  }

  getViolationsByPolicy(policyId: string): PolicyViolation[] {
    const result: PolicyViolation[] = []
    for (const scan of this.scans.values()) {
      result.push(...scan.violations.filter((v) => v.policyId === policyId))
    }
    return result
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
