// Design Ref: §R585 — AI기반 공공 데이터 활용도 분석 v2
// Plan SC: SVC-AI-ADV-R585-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type UsageGrade = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNUSED'

export interface PublicDataset {
  datasetId: string
  title: string
  category: string
  grade: DataGrade
  organization: string
  publishedAt: string
}

export interface UsageRecord {
  datasetId: string
  date: string        // 'YYYY-MM-DD'
  downloadCount: number
  apiCallCount: number
  uniqueUsers: number
}

export interface UsageAnalysis {
  datasetId: string
  title: string
  usageGrade: UsageGrade
  totalDownloads: number
  totalApiCalls: number
  totalUniqueUsers: number
  avgDailyUsage: number
  trend: 'INCREASING' | 'STABLE' | 'DECREASING'
  recommendations: string[]
}

export interface UsageReport {
  totalDatasets: number
  highUsageCount: number
  unusedCount: number
  analyses: UsageAnalysis[]
  topDatasets: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  datasetId: string
  detail: Record<string, unknown>
}

export class PublicDataUsageAnalyzerV2 {
  private datasets = new Map<string, PublicDataset>()
  private usageRecords = new Map<string, UsageRecord[]>()
  private auditLog: AuditEntry[] = []

  registerDataset(dataset: PublicDataset): void {
    // N2SF N-05: C/S 등급 데이터셋 등록 차단
    if (dataset.grade === 'C' || dataset.grade === 'S') {
      throw new Error(`BLOCKED: ${dataset.grade}등급 데이터셋 등록 금지 (N2SF N-05)`)
    }
    this.datasets.set(dataset.datasetId, dataset)
    this.usageRecords.set(dataset.datasetId, [])
    this.appendAudit('dataset.register', dataset.datasetId, { title: dataset.title, category: dataset.category })
  }

  recordUsage(record: UsageRecord): void {
    const records = this.usageRecords.get(record.datasetId)
    if (!records) return
    records.push(record)
    this.appendAudit('usage.record', record.datasetId, { date: record.date, downloads: record.downloadCount })
  }

  analyzeUsage(datasetId: string): UsageAnalysis {
    const dataset = this.datasets.get(datasetId)
    if (!dataset) throw new Error(`Unknown dataset: ${datasetId}`)

    const records = this.usageRecords.get(datasetId) ?? []
    const totalDownloads = records.reduce((s, r) => s + r.downloadCount, 0)
    const totalApiCalls = records.reduce((s, r) => s + r.apiCallCount, 0)
    const totalUniqueUsers = records.reduce((s, r) => s + r.uniqueUsers, 0)
    const avgDailyUsage = records.length > 0 ? Math.round((totalDownloads + totalApiCalls) / records.length) : 0

    const usageGrade: UsageGrade =
      avgDailyUsage >= 100 ? 'HIGH'
        : avgDailyUsage >= 10 ? 'MEDIUM'
        : avgDailyUsage > 0 ? 'LOW'
        : 'UNUSED'

    // 트렌드: 최근 절반 vs 이전 절반 비교
    const trend = this.calculateTrend(records)

    const recommendations: string[] = []
    if (usageGrade === 'UNUSED') recommendations.push('미활용 데이터셋 — 홍보 강화 또는 데이터 품질 개선 검토')
    if (trend === 'DECREASING') recommendations.push('활용도 감소 추세 — 데이터 최신성 및 품질 점검 필요')
    if (usageGrade === 'HIGH') recommendations.push('높은 활용도 — API 안정성 및 SLA 모니터링 강화')

    this.appendAudit('usage.analyze', datasetId, { usageGrade, avgDailyUsage, trend })
    return { datasetId, title: dataset.title, usageGrade, totalDownloads, totalApiCalls, totalUniqueUsers, avgDailyUsage, trend, recommendations }
  }

  generateReport(): UsageReport {
    const datasetIds = Array.from(this.datasets.keys())
    const analyses = datasetIds.map((id) => this.analyzeUsage(id))
    const highUsageCount = analyses.filter((a) => a.usageGrade === 'HIGH').length
    const unusedCount = analyses.filter((a) => a.usageGrade === 'UNUSED').length
    const topDatasets = analyses
      .sort((a, b) => b.avgDailyUsage - a.avgDailyUsage)
      .slice(0, 5)
      .map((a) => a.datasetId)
    this.appendAudit('report.generate', 'system', { totalDatasets: datasetIds.length, highUsageCount, unusedCount })
    return { totalDatasets: datasetIds.length, highUsageCount, unusedCount, analyses, topDatasets, generatedAt: new Date().toISOString() }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private calculateTrend(records: UsageRecord[]): 'INCREASING' | 'STABLE' | 'DECREASING' {
    if (records.length < 2) return 'STABLE'
    const mid = Math.floor(records.length / 2)
    const firstHalf = records.slice(0, mid)
    const secondHalf = records.slice(mid)
    const firstAvg = firstHalf.reduce((s, r) => s + r.downloadCount + r.apiCallCount, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((s, r) => s + r.downloadCount + r.apiCallCount, 0) / secondHalf.length
    if (secondAvg > firstAvg * 1.1) return 'INCREASING'
    if (secondAvg < firstAvg * 0.9) return 'DECREASING'
    return 'STABLE'
  }

  private appendAudit(action: string, datasetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, datasetId, detail })
  }
}
