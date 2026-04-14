// Design Ref: §검증 규칙 — PublicDataStandardizerV2
// Plan SC: SVC-AI-ADV-R509

interface SchemaField {
  name: string
  type: string
  required: boolean
}

interface DataSchema {
  schemaId: string
  name: string
  fields: SchemaField[]
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

interface ValidationStats {
  total: number
  passed: number
  failed: number
}

interface AuditEntry {
  timestamp: string
  action: string
  schemaId: string
  details?: Record<string, unknown>
}

export class PublicDataStandardizerV2 {
  private schemas = new Map<string, DataSchema>()
  private validationStats = new Map<string, ValidationStats>()
  private auditLog: AuditEntry[] = []

  registerSchema(schemaId: string, name: string, fields: SchemaField[]): DataSchema {
    const schema: DataSchema = { schemaId, name, fields }
    this.schemas.set(schemaId, schema)
    this.validationStats.set(schemaId, { total: 0, passed: 0, failed: 0 })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SCHEMA',
      schemaId,
      details: { name, fieldCount: fields.length },
    })
    return schema
  }

  validateRecord(
    schemaId: string,
    record: Record<string, unknown>,
    dataGrade?: string
  ): ValidationResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const schema = this.schemas.get(schemaId)
    if (!schema) throw new Error(`스키마를 찾을 수 없습니다: ${schemaId}`)

    const errors: string[] = []
    for (const field of schema.fields) {
      if (field.required && (record[field.name] === undefined || record[field.name] === null)) {
        errors.push(`필수 필드 누락: ${field.name}`)
        continue
      }
      if (record[field.name] !== undefined && record[field.name] !== null) {
        const actualType = typeof record[field.name]
        if (actualType !== field.type) {
          errors.push(`타입 불일치: ${field.name} (기대: ${field.type}, 실제: ${actualType})`)
        }
      }
    }

    const result: ValidationResult = { valid: errors.length === 0, errors }
    const stats = this.validationStats.get(schemaId)!
    stats.total++
    if (result.valid) stats.passed++
    else stats.failed++

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'VALIDATE_RECORD',
      schemaId,
      details: { valid: result.valid, errorCount: errors.length },
    })
    return result
  }

  getValidationStats(schemaId: string): ValidationStats {
    return this.validationStats.get(schemaId) ?? { total: 0, passed: 0, failed: 0 }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
