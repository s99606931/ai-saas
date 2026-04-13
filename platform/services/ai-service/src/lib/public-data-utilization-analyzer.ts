// Design Ref: §R355 — AI기반 공공 데이터 활용 분석
// Plan SC: SC-R355

export interface PublicDataset {
  datasetId: string
  name: string
  category: string
  dataGrade: 'C' | 'S' | 'O'
  totalRecords: number
  lastUpdatedAt: string
}

export interface DataUtilizationRecord {
  datasetId: string
  timestamp: number
  downloadCount: number
  apiCallCount: number
  uniqueConsumers: number
}

export type UtilizationTrend = 'GROWING' | 'STABLE' | 'DECLINING'

export interface DatasetUtilizationReport {
  datasetId: string
  name: string
  totalDownloads: number
  totalApiCalls: number
  uniqueConsumers: number
  utilizationTrend: UtilizationTrend
  utilizationScore: number
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicDataUtilizationAnalyzer {
  private datasets = new Map<string, PublicDataset>()
  private records = new Map<string, DataUtilizationRecord[]>()
  private auditLog: AuditEntry[] = []

  registerDataset(dataset: PublicDataset): void {
    // N2SF: C/S 등급 데이터셋 분석 차단
    if (dataset.dataGrade === 'C' || dataset.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataset.dataGrade}등급 데이터셋 분석 차단 (N2SF N-05)`)
    }
    this.datasets.set(dataset.datasetId, dataset)
    this.records.set(dataset.datasetId, [])
    this.auditLog.push({ action: 'dataset.register', timestamp: new Date().toISOString(), detail: dataset.datasetId })
  }

  recordUtilization(record: DataUtilizationRecord): void {
    if (!this.datasets.has(record.datasetId)) throw new Error(`Dataset not found: ${record.datasetId}`)
    this.records.get(record.datasetId)!.push(record)
    this.auditLog.push({ action: 'utilization.record', timestamp: new Date().toISOString(), detail: record.datasetId })
  }

  analyze(datasetId: string): DatasetUtilizationReport {
    const dataset = this.datasets.get(datasetId)
    if (!dataset) throw new Error(`Dataset not found: ${datasetId}`)

    const recs = this.records.get(datasetId) ?? []
    const totalDownloads = recs.reduce((s, r) => s + r.downloadCount, 0)
    const totalApiCalls = recs.reduce((s, r) => s + r.apiCallCount, 0)
    const uniqueConsumers = recs.length > 0 ? Math.max(...recs.map((r) => r.uniqueConsumers)) : 0

    // 트렌드: 최근 절반 vs 이전 절반 비교
    let utilizationTrend: UtilizationTrend = 'STABLE'
    if (recs.length >= 2) {
      const half = Math.floor(recs.length / 2)
      const recentSum = recs.slice(half).reduce((s, r) => s + r.apiCallCount + r.downloadCount, 0)
      const oldSum = recs.slice(0, half).reduce((s, r) => s + r.apiCallCount + r.downloadCount, 0)
      if (recentSum > oldSum * 1.1) utilizationTrend = 'GROWING'
      else if (recentSum < oldSum * 0.9) utilizationTrend = 'DECLINING'
    }

    // 활용 점수: API+Download 합산 기준 (정규화 없이 절대값 기반)
    const utilizationScore = Math.min(100, Math.round((totalApiCalls + totalDownloads) / Math.max(dataset.totalRecords, 1) * 100))

    const recommendations: string[] = []
    if (utilizationTrend === 'DECLINING') recommendations.push('활용 감소 추세 — 데이터 품질 및 갱신 주기 점검')
    if (uniqueConsumers < 3) recommendations.push('소수 기관만 활용 중 — 공개 프로모션 및 API 가이드 보완')
    if (utilizationScore < 10) recommendations.push('낮은 활용률 — 데이터 연계 가이드 제공')

    this.auditLog.push({ action: 'utilization.analyze', timestamp: new Date().toISOString(), detail: `${datasetId}:${utilizationTrend}` })
    return { datasetId, name: dataset.name, totalDownloads, totalApiCalls, uniqueConsumers, utilizationTrend, utilizationScore, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
