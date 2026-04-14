// Design Ref: §R557 — AI기반 자동 데이터 거버넌스 강화 v2
// Plan SC: SVC-AI-ADV-R557-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type ViolationType = 'RETENTION_EXCEEDED' | 'MISSING_ENCRYPTION' | 'EXCESSIVE_ACCESS' | 'GRADE_VIOLATION' | 'PII_EXPOSURE'

export interface GovernancePolicy {
  policyId: string
  name: string
  maxRetentionDays: number
  requireEncryption: boolean
  maxAccessCount: number
  allowedGrades: DataGrade[]
}

export interface DataRecord {
  recordId: string
  grade: DataGrade
  retentionDays: number
  encrypted: boolean
  accessCount: number
  piiFields: string[]   // PII 포함 필드명 목록
  ownerId: string
}

export interface GovernanceViolation {
  violationId: string
  recordId: string
  type: ViolationType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  detail: string
  remediationAction: string
}

export interface EnforcementResult {
  recordId: string
  blocked: boolean
  maskedFields: string[]
  violations: GovernanceViolation[]
}

export interface GovernanceReport {
  totalRecords: number
  totalViolations: number
  blockedCount: number
  violationsBySeverity: Record<string, number>
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  recordId: string
  detail: Record<string, unknown>
}

export class DataGovernanceEnforcerV2 {
  private policies = new Map<string, GovernancePolicy>()
  private records = new Map<string, DataRecord>()
  private enforcementResults = new Map<string, EnforcementResult>()
  private auditLog: AuditEntry[] = []

  registerPolicy(policy: GovernancePolicy): void {
    this.policies.set(policy.policyId, policy)
    this.appendAudit('policy.register', policy.policyId, { name: policy.name })
  }

  enforcePolicy(record: DataRecord): EnforcementResult {
    // N2SF N-05: C/S 등급 데이터 처리 차단
    if (record.grade === 'C' || record.grade === 'S') {
      this.appendAudit('enforce.blocked', record.recordId, { grade: record.grade })
      throw new Error(`BLOCKED: ${record.grade}등급 데이터 처리 금지 (N2SF N-05)`)
    }

    this.records.set(record.recordId, record)
    const violations: GovernanceViolation[] = []
    const maskedFields: string[] = []

    // PII 필드 마스킹
    for (const field of record.piiFields) {
      maskedFields.push(field)
    }

    // 정책 위반 검사 (첫 번째 매칭 정책 적용)
    const policy = Array.from(this.policies.values())[0]
    if (policy) {
      this.checkPolicyViolations(record, policy, violations)
    }

    const result: EnforcementResult = { recordId: record.recordId, blocked: false, maskedFields, violations }
    this.enforcementResults.set(record.recordId, result)
    this.appendAudit('enforce.applied', record.recordId, { maskedFields: maskedFields.length, violations: violations.length })
    return result
  }

  detectViolations(records: DataRecord[]): GovernanceViolation[] {
    const allViolations: GovernanceViolation[] = []
    const policy = Array.from(this.policies.values())[0]
    if (!policy) return allViolations

    for (const record of records) {
      if (record.grade === 'C' || record.grade === 'S') {
        allViolations.push({
          violationId: `VIO-${record.recordId}-GRADE`,
          recordId: record.recordId,
          type: 'GRADE_VIOLATION',
          severity: 'CRITICAL',
          detail: `${record.grade}등급 데이터 정책 위반 (N2SF N-05)`,
          remediationAction: '해당 데이터 즉시 격리 및 접근 차단',
        })
      }
      this.checkPolicyViolations(record, policy, allViolations)
    }
    this.appendAudit('violations.detect', 'system', { recordCount: records.length, violationCount: allViolations.length })
    return allViolations
  }

  generateReport(): GovernanceReport {
    const results = Array.from(this.enforcementResults.values())
    const allViolations = results.flatMap((r) => r.violations)
    const violationsBySeverity: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    for (const v of allViolations) {
      violationsBySeverity[v.severity] = (violationsBySeverity[v.severity] ?? 0) + 1
    }
    const recommendations: string[] = []
    if ((violationsBySeverity['CRITICAL'] ?? 0) > 0) recommendations.push('CRITICAL 위반 즉시 경영진 보고 및 시정 조치')
    if ((violationsBySeverity['HIGH'] ?? 0) > 0) recommendations.push('HIGH 위반 5영업일 내 조치 계획 수립')
    this.appendAudit('report.generate', 'system', { totalViolations: allViolations.length })
    return {
      totalRecords: this.records.size,
      totalViolations: allViolations.length,
      blockedCount: results.filter((r) => r.blocked).length,
      violationsBySeverity,
      recommendations,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private checkPolicyViolations(record: DataRecord, policy: GovernancePolicy, violations: GovernanceViolation[]): void {
    if (record.retentionDays > policy.maxRetentionDays) {
      violations.push({
        violationId: `VIO-${record.recordId}-RET`,
        recordId: record.recordId,
        type: 'RETENTION_EXCEEDED',
        severity: 'HIGH',
        detail: `데이터 보존 기간 ${record.retentionDays}일 — 정책 상한(${policy.maxRetentionDays}일) 초과`,
        remediationAction: '데이터 삭제 또는 아카이브 처리',
      })
    }
    if (policy.requireEncryption && !record.encrypted) {
      violations.push({
        violationId: `VIO-${record.recordId}-ENC`,
        recordId: record.recordId,
        type: 'MISSING_ENCRYPTION',
        severity: 'CRITICAL',
        detail: '암호화 미적용 데이터 — 정책 위반 (CSAP D-09)',
        remediationAction: 'AES-256 암호화 즉시 적용',
      })
    }
    if (record.accessCount > policy.maxAccessCount) {
      violations.push({
        violationId: `VIO-${record.recordId}-ACC`,
        recordId: record.recordId,
        type: 'EXCESSIVE_ACCESS',
        severity: 'MEDIUM',
        detail: `접근 횟수 ${record.accessCount} — 정책 상한(${policy.maxAccessCount}) 초과`,
        remediationAction: '접근 로그 검토 및 불필요 접근 차단',
      })
    }
  }

  private appendAudit(action: string, recordId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, recordId, detail })
  }
}
