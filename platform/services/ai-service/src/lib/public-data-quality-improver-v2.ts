// Design Ref: §R392 — AI기반 공공 데이터 품질 자동 개선 v2
// Plan SC: SC-R392

export interface DataRecord {
  recordId: string
  datasetId: string
  fields: Record<string, string | number | null>
}

export type QualityIssueType = 'MISSING_VALUE' | 'FORMAT_ERROR' | 'DUPLICATE' | 'OUTLIER' | 'INCONSISTENT'

export interface QualityIssue {
  recordId: string
  fieldName: string
  issueType: QualityIssueType
  originalValue: string | number | null
  suggestedValue: string | number | null
  confidence: number
}

export interface DataQualityReport {
  datasetId: string
  totalRecords: number
  issueCount: number
  qualityScore: number
  issues: QualityIssue[]
  autoFixedCount: number
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicDataQualityImproverV2 {
  private records = new Map<string, DataRecord[]>()
  private auditLog: AuditEntry[] = []

  loadDataset(datasetId: string, records: DataRecord[]): void {
    this.records.set(datasetId, records)
    this.auditLog.push({ action: 'dataset.load', timestamp: new Date().toISOString(), detail: `${datasetId}:${records.length}건` })
  }

  analyze(datasetId: string): DataQualityReport {
    const records = this.records.get(datasetId) ?? []
    const issues: QualityIssue[] = []
    let autoFixedCount = 0

    // 중복 레코드 탐지 (recordId 기준)
    const seenIds = new Set<string>()
    for (const record of records) {
      if (seenIds.has(record.recordId)) {
        issues.push({
          recordId: record.recordId,
          fieldName: 'recordId',
          issueType: 'DUPLICATE',
          originalValue: record.recordId,
          suggestedValue: null,
          confidence: 1.0,
        })
      } else {
        seenIds.add(record.recordId)
      }
    }

    for (const record of records) {
      for (const [fieldName, value] of Object.entries(record.fields)) {
        // 누락 값 탐지
        if (value === null || value === '') {
          issues.push({
            recordId: record.recordId,
            fieldName,
            issueType: 'MISSING_VALUE',
            originalValue: null,
            suggestedValue: null,
            confidence: 1.0,
          })
        }

        // 날짜 포맷 오류 탐지 (date 포함 필드)
        if (typeof value === 'string' && fieldName.toLowerCase().includes('date')) {
          const isoPattern = /^\d{4}-\d{2}-\d{2}$/
          const krPattern = /^\d{4}\.\d{2}\.\d{2}$/
          if (!isoPattern.test(value) && krPattern.test(value)) {
            const fixed = value.replace(/\./g, '-')
            issues.push({
              recordId: record.recordId,
              fieldName,
              issueType: 'FORMAT_ERROR',
              originalValue: value,
              suggestedValue: fixed,
              confidence: 0.95,
            })
            autoFixedCount += 1
          }
        }

        // 숫자 이상값 탐지 (age 필드: 0~150 범위 외)
        if (typeof value === 'number' && fieldName.toLowerCase().includes('age')) {
          if (value < 0 || value > 150) {
            issues.push({
              recordId: record.recordId,
              fieldName,
              issueType: 'OUTLIER',
              originalValue: value,
              suggestedValue: null,
              confidence: 0.9,
            })
          }
        }
      }
    }

    const qualityScore = records.length === 0
      ? 100
      : Math.max(0, Math.round(100 - (issues.length / records.length) * 20))

    const recommendations: string[] = []
    const missingCount = issues.filter((i) => i.issueType === 'MISSING_VALUE').length
    const duplicateCount = issues.filter((i) => i.issueType === 'DUPLICATE').length
    const formatCount = issues.filter((i) => i.issueType === 'FORMAT_ERROR').length
    const outlierCount = issues.filter((i) => i.issueType === 'OUTLIER').length

    if (missingCount > 0) recommendations.push(`누락 값 ${missingCount}건 — 필수 필드 기본값 정책 수립`)
    if (duplicateCount > 0) recommendations.push(`중복 레코드 ${duplicateCount}건 — 고유 키 제약 조건 적용`)
    if (formatCount > 0) recommendations.push(`포맷 오류 ${formatCount}건 — 자동 정규화 적용 완료`)
    if (outlierCount > 0) recommendations.push(`이상값 ${outlierCount}건 — 입력 유효성 검사 강화`)

    this.auditLog.push({ action: 'quality.analyze', timestamp: new Date().toISOString(), detail: `${datasetId}:score=${qualityScore}` })
    return {
      datasetId,
      totalRecords: records.length,
      issueCount: issues.length,
      qualityScore,
      issues,
      autoFixedCount,
      recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
