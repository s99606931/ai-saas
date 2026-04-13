// Design Ref: §R437 — AI기반 공공 데이터 공개 자동화 v2
// Plan SC: SVC-AI-ADV-R437-SC01

export type DataCategory = 'STATISTICS' | 'GEOGRAPHIC' | 'ADMINISTRATIVE' | 'FINANCIAL' | 'ENVIRONMENT' | 'SOCIAL'
export type OpenDataGrade = 'C' | 'S' | 'O'
export type PublishStatus = 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'REDACTED_APPROVED'

export interface DataSet {
  datasetId: string
  title: string
  category: DataCategory
  grade: OpenDataGrade
  fields: Array<{ name: string; containsPII: boolean; sensitive: boolean }>
  recordCount: number
  lastUpdated: string
}

export interface OpenDataDecision {
  datasetId: string
  status: PublishStatus
  redactedFields: string[]     // 제거된 필드 목록
  reason: string
  openScore: number            // 0..100 (높을수록 공개 적합)
}

interface AuditEntry {
  timestamp: string
  action: string
  datasetId: string
  detail: Record<string, unknown>
}

export class PublicDataOpennessAutomatorV2 {
  private datasets = new Map<string, DataSet>()
  private auditLog: AuditEntry[] = []

  registerDataset(dataset: DataSet): void {
    this.datasets.set(dataset.datasetId, dataset)
    this.appendAudit('dataset.register', dataset.datasetId, { category: dataset.category, grade: dataset.grade })
  }

  evaluate(datasetId: string): OpenDataDecision {
    const dataset = this.datasets.get(datasetId)
    if (!dataset) throw new Error(`Unknown dataset: ${datasetId}`)

    this.appendAudit('dataset.evaluate', datasetId, { grade: dataset.grade })

    // N2SF C/S 등급: 공개 불가
    if (dataset.grade === 'C') {
      return { datasetId, status: 'REJECTED', redactedFields: [], reason: 'C등급 기밀 데이터 — 공개 불가 (N2SF N-05)', openScore: 0 }
    }
    if (dataset.grade === 'S') {
      return { datasetId, status: 'REJECTED', redactedFields: [], reason: 'S등급 보안 데이터 — 공개 불가 (N2SF N-05)', openScore: 0 }
    }

    // PII 필드 및 민감 필드 식별
    const piiFields = dataset.fields.filter((f) => f.containsPII).map((f) => f.name)
    const sensitiveFields = dataset.fields.filter((f) => f.sensitive && !f.containsPII).map((f) => f.name)
    const redactedFields = piiFields  // PII는 반드시 제거

    // 공개 점수 계산
    let openScore = 100
    const piiRatio = dataset.fields.length > 0 ? piiFields.length / dataset.fields.length : 0
    openScore -= Math.round(piiRatio * 40)  // PII 비율에 따른 감점
    openScore -= sensitiveFields.length * 5  // 민감 필드 수 감점
    openScore = Math.max(0, Math.min(100, openScore))

    let status: PublishStatus
    let reason: string

    if (piiFields.length > 0 && sensitiveFields.length === 0) {
      status = 'REDACTED_APPROVED'
      reason = `PII 필드 ${piiFields.length}개 제거 후 공개 승인`
    } else if (piiFields.length > 0) {
      status = 'REDACTED_APPROVED'
      reason = `PII ${piiFields.length}개 + 민감 필드 ${sensitiveFields.length}개 — PII 제거 후 조건부 승인`
    } else if (openScore >= 70) {
      status = 'APPROVED'
      reason = '공개 적합 데이터 — 즉시 공개 승인'
    } else {
      status = 'PENDING_REVIEW'
      reason = `공개 점수 ${openScore}점 — 담당자 검토 필요`
    }

    return { datasetId, status, redactedFields, reason, openScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, datasetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, datasetId, detail })
  }
}
