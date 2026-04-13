// Design Ref: §R297 — AI기반 데이터 자동 분류 v2
// Plan SC: SC-R297

export interface DataField {
  fieldName: string
  sampleValues: string[]
}

export interface DataRecord {
  recordId: string
  fields: DataField[]
}

export type DataGrade = 'C' | 'S' | 'O'

export interface ClassificationResult {
  recordId: string
  grade: DataGrade
  detectedPatterns: DetectedPattern[]
  recommendations: string[]
}

export interface DetectedPattern {
  fieldName: string
  patternType: 'SSN' | 'BANK_ACCOUNT' | 'PASSPORT' | 'PHONE' | 'EMAIL' | 'NAME' | 'UNKNOWN'
  grade: DataGrade
  confidence: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const PATTERNS: { type: DetectedPattern['patternType']; regex: RegExp; grade: DataGrade; confidence: number }[] = [
  { type: 'SSN', regex: /\d{6}-[1-4]\d{6}/, grade: 'C', confidence: 0.98 },
  { type: 'BANK_ACCOUNT', regex: /\d{10,16}/, grade: 'C', confidence: 0.85 },
  { type: 'PASSPORT', regex: /[A-Z]{1,2}\d{7,9}/, grade: 'C', confidence: 0.92 },
  { type: 'PHONE', regex: /0[1-9]\d{7,9}/, grade: 'S', confidence: 0.90 },
  { type: 'EMAIL', regex: /[^\s@]+@[^\s@]+\.[^\s@]+/, grade: 'S', confidence: 0.95 },
  { type: 'NAME', regex: /^[\uAC00-\uD7A3]{2,4}$/, grade: 'S', confidence: 0.70 },
]

const GRADE_PRIORITY: Record<DataGrade, number> = { C: 3, S: 2, O: 1 }

export class AutoDataClassifierV2 {
  private auditLog: AuditEntry[] = []

  classify(record: DataRecord): ClassificationResult {
    const detectedPatterns: DetectedPattern[] = []
    let highestGrade: DataGrade = 'O'

    for (const field of record.fields) {
      for (const sample of field.sampleValues) {
        for (const pattern of PATTERNS) {
          if (pattern.regex.test(sample)) {
            detectedPatterns.push({
              fieldName: field.fieldName,
              patternType: pattern.type,
              grade: pattern.grade,
              confidence: pattern.confidence,
            })
            if (GRADE_PRIORITY[pattern.grade] > GRADE_PRIORITY[highestGrade]) {
              highestGrade = pattern.grade
            }
            break
          }
        }
      }
    }

    const recommendations: string[] = []
    if (highestGrade === 'C') {
      recommendations.push('C등급 데이터 — AES-256 암호화 필수, AI API 전송 절대 금지 (N2SF N-05)')
      recommendations.push('접근 제어 RBAC 강화 필요 (CSAP D-08)')
    } else if (highestGrade === 'S') {
      recommendations.push('S등급 데이터 — 마스킹 후 내부 사용만 허용')
    }

    this.auditLog.push({ action: 'data.classify', timestamp: new Date().toISOString(), detail: `${record.recordId}→${highestGrade}` })
    return { recordId: record.recordId, grade: highestGrade, detectedPatterns, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
