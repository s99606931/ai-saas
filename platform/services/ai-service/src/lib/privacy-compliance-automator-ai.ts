// Design Ref: §R276 — AI기반 개인정보 자동 준수
// Plan SC: SVC-AI-ADV-R276-SC01
// CSAP D-06: 감사 로그, D-09: 암호화, N2SF N-05: 개인정보 보호

export type PiiCategory = 'NAME' | 'SSN' | 'EMAIL' | 'PHONE' | 'ADDRESS' | 'BANK_ACCOUNT' | 'IP_ADDRESS'
export type ComplianceStatus = 'COMPLIANT' | 'VIOLATION' | 'WARNING'
export type DataSubjectRight = 'ACCESS' | 'RECTIFICATION' | 'ERASURE' | 'PORTABILITY' | 'OBJECTION'

export interface PiiFieldMapping {
  fieldName: string
  piiCategory: PiiCategory
  encrypted: boolean
  masked: boolean
  retentionDays: number
}

export interface DataProcessingRecord {
  recordId: string
  purpose: string
  fields: PiiFieldMapping[]
  consentObtained: boolean
  legalBasis: string
}

export interface ComplianceViolation {
  recordId: string
  fieldName?: string
  violationType: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  description: string
}

export interface ComplianceReport {
  recordId: string
  status: ComplianceStatus
  violations: ComplianceViolation[]
  piiFieldCount: number
  encryptedCount: number
  maskedCount: number
  complianceScore: number  // 0~100
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  recordId: string
  detail: Record<string, unknown>
}

// 반드시 암호화해야 하는 PII 카테고리
const MUST_ENCRYPT: PiiCategory[] = ['SSN', 'BANK_ACCOUNT']
// 반드시 마스킹해야 하는 카테고리
const MUST_MASK: PiiCategory[] = ['SSN', 'BANK_ACCOUNT', 'PHONE']

export class PrivacyComplianceAutomatorAi {
  private records = new Map<string, DataProcessingRecord>()
  private auditLog: AuditEntry[] = []

  registerRecord(record: DataProcessingRecord): void {
    if (!record.consentObtained && !record.legalBasis) {
      throw new Error('동의 미획득 시 법적 근거가 필요합니다')
    }
    this.records.set(record.recordId, record)
    this.appendAudit('record.register', record.recordId, { purpose: record.purpose, fieldCount: record.fields.length })
  }

  audit(recordId: string): ComplianceReport {
    const record = this.records.get(recordId)
    if (!record) throw new Error(`Unknown record: ${recordId}`)

    const violations: ComplianceViolation[] = []
    let deduction = 0

    // 동의 없이 법적 근거도 불충분한 경우
    if (!record.consentObtained && record.legalBasis === '') {
      violations.push({ recordId, violationType: 'NO_CONSENT', severity: 'CRITICAL', description: '개인정보 처리 동의 미확보' })
      deduction += 30
    }

    for (const field of record.fields) {
      // 필수 암호화 미적용
      if (MUST_ENCRYPT.includes(field.piiCategory) && !field.encrypted) {
        violations.push({
          recordId,
          fieldName: field.fieldName,
          violationType: 'NOT_ENCRYPTED',
          severity: 'CRITICAL',
          description: `${field.piiCategory} 필드 ${field.fieldName} 암호화 미적용 (CSAP D-09)`,
        })
        deduction += 20
      }

      // 필수 마스킹 미적용
      if (MUST_MASK.includes(field.piiCategory) && !field.masked) {
        violations.push({
          recordId,
          fieldName: field.fieldName,
          violationType: 'NOT_MASKED',
          severity: 'HIGH',
          description: `${field.piiCategory} 필드 ${field.fieldName} 마스킹 미적용`,
        })
        deduction += 15
      }

      // 과도한 보존 기간
      if (field.retentionDays > 1825) {  // 5년 초과
        violations.push({
          recordId,
          fieldName: field.fieldName,
          violationType: 'EXCESSIVE_RETENTION',
          severity: 'MEDIUM',
          description: `${field.fieldName} 보존 기간 ${field.retentionDays}일 — 최소 필요 기간 검토 권고`,
        })
        deduction += 5
      }
    }

    const encryptedCount = record.fields.filter((f) => f.encrypted).length
    const maskedCount = record.fields.filter((f) => f.masked).length
    const complianceScore = Math.max(0, 100 - deduction)

    const status: ComplianceStatus =
      violations.some((v) => v.severity === 'CRITICAL') ? 'VIOLATION' :
      violations.length > 0 ? 'WARNING' : 'COMPLIANT'

    const recommendation =
      status === 'VIOLATION' ? '개인정보 처리 즉시 중단 및 보완 조치 필요' :
      status === 'WARNING' ? '개인정보 보호 조치 보강 권고' :
      '개인정보 처리 기준 준수 양호'

    this.appendAudit('privacy.audit', recordId, { status, complianceScore, violationCount: violations.length })

    return { recordId, status, violations, piiFieldCount: record.fields.length, encryptedCount, maskedCount, complianceScore, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, recordId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, recordId, detail })
  }
}
