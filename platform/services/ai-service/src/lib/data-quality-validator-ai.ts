// Design Ref: §R370 — AI기반 자동 데이터 품질 검증
// Plan SC: SVC-AI-ADV-R370-SC01

export type FieldType = 'STRING' | 'NUMBER' | 'DATE' | 'EMAIL' | 'PHONE' | 'BOOLEAN'
export type QualityStatus = 'PASSED' | 'WARNING' | 'FAILED'
export type DataGrade = 'C' | 'S' | 'O'

export interface FieldSchema {
  fieldName: string
  type: FieldType
  required: boolean
  minLength?: number
  maxLength?: number
  pattern?: string  // regex string
}

export interface DataRecord {
  datasetId: string
  grade: DataGrade
  fields: Record<string, unknown>
}

export interface ValidationIssue {
  fieldName: string
  severity: 'ERROR' | 'WARNING'
  message: string
}

export interface ValidationResult {
  datasetId: string
  status: QualityStatus
  qualityScore: number  // 0..100
  issues: ValidationIssue[]
  passedFields: number
  totalFields: number
}

interface AuditEntry {
  timestamp: string
  action: string
  datasetId: string
  detail: Record<string, unknown>
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/

export class DataQualityValidatorAI {
  private schemas = new Map<string, FieldSchema[]>()
  private auditLog: AuditEntry[] = []

  registerSchema(datasetId: string, schema: FieldSchema[]): void {
    this.schemas.set(datasetId, schema)
    this.appendAudit('schema.register', datasetId, { fieldCount: schema.length })
  }

  validate(record: DataRecord): ValidationResult {
    // N2SF C/S 등급 차단
    if (record.grade === 'C' || record.grade === 'S') {
      throw new Error(`BLOCKED: ${record.grade}등급 데이터는 AI 품질 검증 금지 (N2SF N-05)`)
    }

    const schema = this.schemas.get(record.datasetId)
    if (!schema) throw new Error(`Unknown schema: ${record.datasetId}`)

    const issues: ValidationIssue[] = []
    let passedFields = 0

    for (const fieldDef of schema) {
      const value = record.fields[fieldDef.fieldName]
      let fieldPassed = true

      // 필수 필드 검사
      if (fieldDef.required && (value === undefined || value === null || value === '')) {
        issues.push({ fieldName: fieldDef.fieldName, severity: 'ERROR', message: `필수 필드 누락` })
        fieldPassed = false
        continue
      }

      if (value === undefined || value === null) {
        passedFields++
        continue
      }

      const strValue = String(value)

      // 타입별 검사
      if (fieldDef.type === 'NUMBER' && isNaN(Number(value))) {
        issues.push({ fieldName: fieldDef.fieldName, severity: 'ERROR', message: `숫자 형식 오류` })
        fieldPassed = false
      } else if (fieldDef.type === 'EMAIL' && !EMAIL_PATTERN.test(strValue)) {
        issues.push({ fieldName: fieldDef.fieldName, severity: 'ERROR', message: `이메일 형식 오류` })
        fieldPassed = false
      } else if (fieldDef.type === 'PHONE' && !PHONE_PATTERN.test(strValue)) {
        issues.push({ fieldName: fieldDef.fieldName, severity: 'WARNING', message: `전화번호 형식 주의` })
      } else if (fieldDef.type === 'DATE' && isNaN(Date.parse(strValue))) {
        issues.push({ fieldName: fieldDef.fieldName, severity: 'ERROR', message: `날짜 형식 오류` })
        fieldPassed = false
      }

      // 길이 검사
      if (fieldDef.minLength !== undefined && strValue.length < fieldDef.minLength) {
        issues.push({ fieldName: fieldDef.fieldName, severity: 'WARNING', message: `최소 길이 ${fieldDef.minLength} 미달` })
      }
      if (fieldDef.maxLength !== undefined && strValue.length > fieldDef.maxLength) {
        issues.push({ fieldName: fieldDef.fieldName, severity: 'ERROR', message: `최대 길이 ${fieldDef.maxLength} 초과` })
        fieldPassed = false
      }

      // 패턴 검사
      if (fieldDef.pattern && !new RegExp(fieldDef.pattern).test(strValue)) {
        issues.push({ fieldName: fieldDef.fieldName, severity: 'WARNING', message: `패턴 불일치: ${fieldDef.pattern}` })
      }

      if (fieldPassed) passedFields++
    }

    const totalFields = schema.length
    const errorCount = issues.filter((i) => i.severity === 'ERROR').length
    const qualityScore = totalFields > 0 ? Math.round((passedFields / totalFields) * 100) : 100

    const status: QualityStatus =
      errorCount > 0 ? 'FAILED'
        : issues.length > 0 ? 'WARNING'
        : 'PASSED'

    this.appendAudit('data.validate', record.datasetId, { status, qualityScore, issues: issues.length })

    return { datasetId: record.datasetId, status, qualityScore, issues, passedFields, totalFields }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, datasetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, datasetId, detail })
  }
}
