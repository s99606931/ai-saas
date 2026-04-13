// Design Ref: §R332 — AI기반 공공 데이터 표준화 자동화
// Plan SC: SC-R332

export interface DataField {
  fieldName: string
  value: unknown
  detectedType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'UNKNOWN'
}

export interface DataRecord {
  recordId: string
  source: string
  fields: DataField[]
}

export interface StandardizationIssue {
  fieldName: string
  issueType: 'INVALID_DATE' | 'INCONSISTENT_FORMAT' | 'MISSING_VALUE' | 'TYPE_MISMATCH' | 'OUT_OF_RANGE'
  originalValue: unknown
  standardizedValue: unknown
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface StandardizationResult {
  recordId: string
  issues: StandardizationIssue[]
  standardizedFields: DataField[]
  qualityScore: number
  isAcceptable: boolean
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const DATE_PATTERNS = [
  { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'ISO' },
  { pattern: /^\d{4}\.\d{2}\.\d{2}$/, format: 'DOT' },
  { pattern: /^\d{4}\/\d{2}\/\d{2}$/, format: 'SLASH' },
  { pattern: /^\d{8}$/, format: 'COMPACT' },
]

function normalizeDate(value: string): string | null {
  for (const { pattern, format } of DATE_PATTERNS) {
    if (pattern.test(value)) {
      if (format === 'ISO') return value
      if (format === 'DOT') return value.replace(/\./g, '-')
      if (format === 'SLASH') return value.replace(/\//g, '-')
      if (format === 'COMPACT') return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    }
  }
  return null
}

export class PublicDataStandardizerAi {
  private auditLog: AuditEntry[] = []

  standardize(record: DataRecord): StandardizationResult {
    const issues: StandardizationIssue[] = []
    const standardizedFields: DataField[] = []

    for (const field of record.fields) {
      let standardizedValue: unknown = field.value
      let detectedType = field.detectedType

      if (field.value === null || field.value === undefined || field.value === '') {
        issues.push({ fieldName: field.fieldName, issueType: 'MISSING_VALUE', originalValue: field.value, standardizedValue: null, severity: 'HIGH' })
        standardizedFields.push({ ...field, value: null })
        continue
      }

      if (field.detectedType === 'DATE') {
        const strVal = String(field.value)
        const normalized = normalizeDate(strVal)
        if (!normalized) {
          issues.push({ fieldName: field.fieldName, issueType: 'INVALID_DATE', originalValue: field.value, standardizedValue: null, severity: 'HIGH' })
          standardizedValue = null
        } else if (normalized !== strVal) {
          issues.push({ fieldName: field.fieldName, issueType: 'INCONSISTENT_FORMAT', originalValue: field.value, standardizedValue: normalized, severity: 'LOW' })
          standardizedValue = normalized
        }
      } else if (field.detectedType === 'NUMBER') {
        const num = Number(field.value)
        if (isNaN(num)) {
          issues.push({ fieldName: field.fieldName, issueType: 'TYPE_MISMATCH', originalValue: field.value, standardizedValue: null, severity: 'MEDIUM' })
          standardizedValue = null
        } else {
          standardizedValue = num
        }
      } else if (field.detectedType === 'STRING') {
        standardizedValue = String(field.value).trim()
      }

      standardizedFields.push({ fieldName: field.fieldName, value: standardizedValue, detectedType })
    }

    const highCount = issues.filter((i) => i.severity === 'HIGH').length
    const medCount = issues.filter((i) => i.severity === 'MEDIUM').length
    const qualityScore = Math.max(0, 100 - highCount * 20 - medCount * 10)
    const isAcceptable = qualityScore >= 60

    this.auditLog.push({ action: 'data.standardize', timestamp: new Date().toISOString(), detail: `${record.recordId}:${qualityScore}` })
    return { recordId: record.recordId, issues, standardizedFields, qualityScore, isAcceptable }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
