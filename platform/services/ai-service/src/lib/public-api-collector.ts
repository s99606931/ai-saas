// SVC-AI-ADV-R49: 공공 API 수집기 + 스키마 추론
// Design Ref: §모듈, §인터페이스
// Plan SC: FR-R49.2

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'null' | 'object' | 'array' | 'unknown'

export interface InferredField {
  name: string
  types: FieldType[]
  nullable: boolean
  samples: unknown[]
}

export interface InferredSchema {
  fields: Map<string, InferredField>
  totalRecords: number
  inferredAt: Date
}

export interface ValidationIssue {
  field: string
  issue: string
  recordIndex?: number
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  validRecords: number
  invalidRecords: number
}

/**
 * 공공 API 수집 유틸 — 스키마 추론, 검증, 정제.
 */
export class PublicAPICollector {
  /**
   * 샘플 레코드 배열로부터 스키마 추론.
   */
  inferSchema(samples: unknown[]): InferredSchema {
    if (!Array.isArray(samples)) {
      throw new Error('samples must be an array')
    }

    const fields = new Map<string, InferredField>()

    for (const record of samples) {
      if (!record || typeof record !== 'object') continue
      const obj = record as Record<string, unknown>
      for (const [key, value] of Object.entries(obj)) {
        let f = fields.get(key)
        if (!f) {
          f = { name: key, types: [], nullable: false, samples: [] }
          fields.set(key, f)
        }
        const t = this.detectType(value)
        if (!f.types.includes(t)) f.types.push(t)
        if (t === 'null') f.nullable = true
        if (f.samples.length < 3 && value !== null) f.samples.push(value)
      }
    }

    return {
      fields,
      totalRecords: samples.length,
      inferredAt: new Date(),
    }
  }

  /**
   * 데이터를 추론 스키마 기준으로 검증.
   */
  validate(data: unknown[], schema: InferredSchema): ValidationResult {
    const issues: ValidationIssue[] = []
    let valid = 0
    let invalid = 0

    for (let i = 0; i < data.length; i += 1) {
      const record = data[i]
      if (!record || typeof record !== 'object') {
        issues.push({ field: '*', issue: 'not an object', recordIndex: i })
        invalid += 1
        continue
      }
      const obj = record as Record<string, unknown>
      let recordValid = true

      for (const [name, field] of schema.fields) {
        if (!(name in obj)) {
          if (!field.nullable) {
            issues.push({ field: name, issue: 'missing required field', recordIndex: i })
            recordValid = false
          }
          continue
        }
        const actualType = this.detectType(obj[name])
        if (!field.types.includes(actualType)) {
          issues.push({
            field: name,
            issue: `type mismatch: expected ${field.types.join('|')}, got ${actualType}`,
            recordIndex: i,
          })
          recordValid = false
        }
      }

      if (recordValid) valid += 1
      else invalid += 1
    }

    return { valid: invalid === 0, issues, validRecords: valid, invalidRecords: invalid }
  }

  /**
   * 데이터 정제 — NULL/undefined 제거, 날짜 정규화, 공백 trim.
   */
  clean(data: unknown[]): unknown[] {
    const cleaned: unknown[] = []
    for (const record of data) {
      if (!record || typeof record !== 'object') continue
      const obj = record as Record<string, unknown>
      const normalized: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) continue
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (trimmed === '') continue
          normalized[key] = this.maybeNormalizeDate(trimmed)
        } else {
          normalized[key] = value
        }
      }

      if (Object.keys(normalized).length > 0) {
        cleaned.push(normalized)
      }
    }
    return cleaned
  }

  private detectType(value: unknown): FieldType {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date'
      return 'string'
    }
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') return 'object'
    return 'unknown'
  }

  private maybeNormalizeDate(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    if (/^\d{8}$/.test(value)) {
      return `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`
    }
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(value)) {
      return value.replace(/\./g, '-')
    }
    return value
  }
}

export function createPublicAPICollector(): PublicAPICollector {
  return new PublicAPICollector()
}
