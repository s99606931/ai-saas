// Design Ref: §R271 — 공공데이터 품질 ETL 엔진
// Plan SC: SVC-AI-ADV-R271-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type FieldType = 'string' | 'number' | 'date' | 'boolean'

export interface FieldDef {
  name: string
  type: FieldType
  required: boolean
  pattern?: string
}

export interface SchemaDef {
  schemaName: string
  fields: FieldDef[]
}

export type DataRecord = Record<string, unknown>

export interface RecordResult {
  valid: boolean
  errors: string[]
}

export interface DatasetQuality {
  schemaName: string
  totalRecords: number
  validRecords: number
  completenessPct: number
  validityPct: number
  consistencyPct: number
  overallScore: number
  errorSummary: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class OpenDataQualityEtl {
  private schemas = new Map<string, SchemaDef>()
  private auditLog: AuditEntry[] = []

  defineSchema(schema: SchemaDef, caller: string): void {
    if (!schema.schemaName) throw new Error('schemaName 필수')
    if (schema.fields.length === 0) throw new Error('fields 최소 1개 필요')
    if (this.schemas.has(schema.schemaName)) {
      throw new Error(`중복 schemaName: ${schema.schemaName}`)
    }
    // 필드명 중복 체크
    const seen = new Set<string>()
    for (const f of schema.fields) {
      if (seen.has(f.name)) {
        throw new Error(`중복 필드명: ${f.name}`)
      }
      seen.add(f.name)
    }
    this.schemas.set(schema.schemaName, { ...schema, fields: [...schema.fields] })
    this.appendAudit('schema.define', this.mask(caller), {
      schemaName: schema.schemaName,
      fieldCount: schema.fields.length,
    })
  }

  validateRecord(schemaName: string, record: DataRecord, grade: DataGrade): RecordResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 레코드 검증 금지 (N2SF N-05)`)
    }
    const schema = this.schemas.get(schemaName)
    if (!schema) throw new Error(`schemaName 없음: ${schemaName}`)

    const errors: string[] = []
    for (const field of schema.fields) {
      const value = record[field.name]
      const missing = value === undefined || value === null || value === ''

      if (field.required && missing) {
        errors.push(`필수 누락: ${field.name}`)
        continue
      }
      if (missing) continue

      // 타입 검증
      if (!this.checkType(value, field.type)) {
        errors.push(`타입 불일치: ${field.name} (${field.type})`)
        continue
      }

      // 패턴 검증
      if (field.pattern && field.type === 'string') {
        try {
          const re = new RegExp(field.pattern)
          if (!re.test(String(value))) {
            errors.push(`패턴 불일치: ${field.name}`)
          }
        } catch {
          errors.push(`패턴 파싱 실패: ${field.name}`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  runQualityCheck(
    schemaName: string,
    records: DataRecord[],
    grade: DataGrade,
    caller: string
  ): DatasetQuality {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 품질 검사 금지 (N2SF N-05)`)
    }
    const schema = this.schemas.get(schemaName)
    if (!schema) throw new Error(`schemaName 없음: ${schemaName}`)
    if (records.length === 0) {
      throw new Error('records 최소 1개 필요')
    }

    let validCount = 0
    let completenessSum = 0
    let validitySum = 0
    const errorSet = new Set<string>()

    const requiredFields = schema.fields.filter((f) => f.required)
    const requiredCount = Math.max(1, requiredFields.length)
    const totalFields = Math.max(1, schema.fields.length)

    for (const record of records) {
      const result = this.validateRecord(schemaName, record, 'O')
      if (result.valid) validCount++

      // 완전성: required 필드 채움 비율
      let filledRequired = 0
      for (const f of requiredFields) {
        const v = record[f.name]
        if (v !== undefined && v !== null && v !== '') filledRequired++
      }
      completenessSum += filledRequired / requiredCount

      // 유효성: 전체 필드 중 타입/패턴 오류 없는 비율
      let validFields = 0
      for (const f of schema.fields) {
        const v = record[f.name]
        if (v === undefined || v === null || v === '') {
          if (!f.required) validFields++
          continue
        }
        if (!this.checkType(v, f.type)) continue
        if (f.pattern && f.type === 'string') {
          try {
            if (!new RegExp(f.pattern).test(String(v))) continue
          } catch {
            continue
          }
        }
        validFields++
      }
      validitySum += validFields / totalFields

      for (const err of result.errors) errorSet.add(err)
    }

    // 일관성: 필드별 타입 통일성
    let consistencySum = 0
    for (const f of schema.fields) {
      const values = records
        .map((r) => r[f.name])
        .filter((v) => v !== undefined && v !== null && v !== '')
      if (values.length === 0) {
        consistencySum += 1
        continue
      }
      const consistent = values.filter((v) => this.checkType(v, f.type)).length
      consistencySum += consistent / values.length
    }
    const consistencyPct = Math.round((consistencySum / totalFields) * 100)

    const completenessPct = Math.round((completenessSum / records.length) * 100)
    const validityPct = Math.round((validitySum / records.length) * 100)
    const overallScore = Math.round(
      completenessPct * 0.4 + validityPct * 0.4 + consistencyPct * 0.2
    )

    const result: DatasetQuality = {
      schemaName,
      totalRecords: records.length,
      validRecords: validCount,
      completenessPct,
      validityPct,
      consistencyPct,
      overallScore,
      errorSummary: [...errorSet].slice(0, 10),
    }

    this.appendAudit('quality.check', this.mask(caller), {
      schemaName,
      totalRecords: records.length,
      overallScore,
    })
    return result
  }

  listSchemas(): string[] {
    return [...this.schemas.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private checkType(value: unknown, type: FieldType): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !Number.isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'date':
        if (typeof value !== 'string' && !(value instanceof Date)) return false
        const d = value instanceof Date ? value : new Date(value)
        return !Number.isNaN(d.getTime())
      default:
        return false
    }
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(
    action: string,
    callerMasked: string,
    detail: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
