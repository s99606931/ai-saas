/**
 * Public Data Quality Checker — SVC-AI-ADV-R193 (트랙 B 5차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R193/SVC-AI-ADV-R193.design.md
 * Plan SC: FR-R193.1 ~ FR-R193.5
 *
 * 공공 데이터셋 스키마 기반 품질 검사: completeness + validity.
 */

export type FieldType = 'string' | 'number' | 'date' | 'boolean'

export interface FieldSchema {
  name: string
  type: FieldType
  required: boolean
  pattern?: string
}

export interface DatasetSchema {
  schemaId: string
  name: string
  fields: FieldSchema[]
}

export interface ValidationError {
  row: number
  field: string
  value: unknown
  reason: string
}

export interface QualityReport {
  schemaId: string
  totalRows: number
  validRows: number
  completenessScore: number
  validityScore: number
  errors: ValidationError[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  schemaId: string
  detail: Record<string, unknown>
}

export class PublicDataQualityChecker {
  private readonly schemas = new Map<string, DatasetSchema>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R193.1
  registerSchema(schema: DatasetSchema): void {
    this.schemas.set(schema.schemaId, { ...schema, fields: schema.fields.map((f) => ({ ...f })) })
    this.appendAudit('schema.register', schema.schemaId, { name: schema.name, fieldCount: schema.fields.length })
  }

  // Plan SC: FR-R193.2 + FR-R193.3 + FR-R193.4 — Design Ref: §알고리즘
  validate(schemaId: string, rows: Record<string, unknown>[]): QualityReport {
    const schema = this.schemas.get(schemaId)
    if (!schema) throw new Error(`Unknown schema: ${schemaId}`)

    const errors: ValidationError[] = []
    let completeRows = 0
    let validRows = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      let rowComplete = true
      let rowValid = true

      for (const field of schema.fields) {
        const val = row[field.name]

        // completeness: 필수 필드 존재 검사
        if (field.required && (val === undefined || val === null || val === '')) {
          errors.push({ row: i, field: field.name, value: val, reason: '필수 필드 누락' })
          rowComplete = false
          rowValid = false
          continue
        }
        if (val === undefined || val === null) continue

        // validity: 타입 검사
        let typeOk = true
        if (field.type === 'number' && !isFinite(Number(val))) {
          typeOk = false
          errors.push({ row: i, field: field.name, value: val, reason: `타입 오류: number 기대, 실제값 "${val}"` })
        } else if (field.type === 'boolean' && val !== true && val !== false && val !== 'true' && val !== 'false') {
          typeOk = false
          errors.push({ row: i, field: field.name, value: val, reason: `타입 오류: boolean 기대` })
        } else if (field.type === 'date' && isNaN(Date.parse(String(val)))) {
          typeOk = false
          errors.push({ row: i, field: field.name, value: val, reason: `타입 오류: date 기대` })
        }

        // pattern 검사
        if (typeOk && field.pattern) {
          const regex = new RegExp(field.pattern)
          if (!regex.test(String(val))) {
            typeOk = false
            errors.push({ row: i, field: field.name, value: val, reason: `패턴 불일치: ${field.pattern}` })
          }
        }

        if (!typeOk) rowValid = false
      }

      if (rowComplete) completeRows++
      if (rowValid) validRows++
    }

    const total = rows.length
    const report: QualityReport = {
      schemaId,
      totalRows: total,
      validRows,
      completenessScore: total === 0 ? 0 : Math.round((completeRows / total) * 10000) / 10000,
      validityScore: total === 0 ? 0 : Math.round((validRows / total) * 10000) / 10000,
      errors,
    }
    this.appendAudit('data.validate', schemaId, { totalRows: total, validRows, errorCount: errors.length })
    return report
  }

  // Plan SC: FR-R193.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, schemaId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, schemaId, detail })
  }
}
