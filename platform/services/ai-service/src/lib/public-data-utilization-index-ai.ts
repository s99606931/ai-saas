// Design Ref: §R416 — AI기반 공공 데이터 활용 지수 산출
// Plan SC: SC-R416

export interface PublicDataset {
  datasetId: string
  name: string
  category: string
  dataGrade: 'C' | 'S' | 'O'
  accessCount: number
  downloadCount: number
  lastAccessedAt: string
}

export type UtilizationLevel = 'HIGH_UTILIZATION' | 'MEDIUM_UTILIZATION' | 'LOW_UTILIZATION'

export interface UtilizationIndex {
  datasetId: string
  name: string
  utilizationScore: number
  utilizationLevel: UtilizationLevel
  recommendations: string[]
}

export interface UtilizationReport {
  totalDatasets: number
  calculatedCount: number
  blockedCount: number
  averageScore: number
  datasets: UtilizationIndex[]
  lowUtilizationDatasets: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicDataUtilizationIndexAi {
  private datasets = new Map<string, PublicDataset>()
  private auditLog: AuditEntry[] = []

  registerDataset(dataset: PublicDataset): void {
    // N2SF: C/S 등급 차단
    if (dataset.dataGrade === 'C' || dataset.dataGrade === 'S') {
      this.auditLog.push({ action: 'dataset.blocked', timestamp: new Date().toISOString(), detail: `${dataset.datasetId}:${dataset.dataGrade}` })
      throw new Error(`BLOCKED: ${dataset.dataGrade}등급 데이터 활용 지수 산출 차단 (N2SF N-05)`)
    }
    this.datasets.set(dataset.datasetId, dataset)
    this.auditLog.push({ action: 'dataset.register', timestamp: new Date().toISOString(), detail: dataset.datasetId })
  }

  calculate(): UtilizationReport {
    const allDatasets = Array.from(this.datasets.values())

    if (allDatasets.length === 0) {
      this.auditLog.push({ action: 'utilization.calculate', timestamp: new Date().toISOString(), detail: 'empty' })
      return { totalDatasets: 0, calculatedCount: 0, blockedCount: 0, averageScore: 0, datasets: [], lowUtilizationDatasets: [] }
    }

    // 정규화 기준값
    const maxAccess = Math.max(...allDatasets.map((d) => d.accessCount), 1)
    const maxDownload = Math.max(...allDatasets.map((d) => d.downloadCount), 1)

    const datasetIndices: UtilizationIndex[] = []
    for (const dataset of allDatasets) {
      const normalizedAccess = dataset.accessCount / maxAccess
      const normalizedDownload = dataset.downloadCount / maxDownload
      const utilizationScore = Math.round((normalizedAccess * 0.4 + normalizedDownload * 0.6) * 100)

      const utilizationLevel: UtilizationLevel = utilizationScore >= 70
        ? 'HIGH_UTILIZATION'
        : utilizationScore >= 20
          ? 'MEDIUM_UTILIZATION'
          : 'LOW_UTILIZATION'

      const recommendations: string[] = []
      if (utilizationLevel === 'LOW_UTILIZATION') recommendations.push('홍보 강화 및 API 연계 확대 검토')
      if (utilizationLevel === 'HIGH_UTILIZATION') recommendations.push('캐싱 및 CDN 적용으로 성능 최적화')

      datasetIndices.push({ datasetId: dataset.datasetId, name: dataset.name, utilizationScore, utilizationLevel, recommendations })
    }

    const averageScore = Math.round(datasetIndices.reduce((s, d) => s + d.utilizationScore, 0) / datasetIndices.length)
    const lowUtilizationDatasets = datasetIndices.filter((d) => d.utilizationLevel === 'LOW_UTILIZATION').map((d) => d.datasetId)

    this.auditLog.push({ action: 'utilization.calculate', timestamp: new Date().toISOString(), detail: `avg=${averageScore}` })
    return {
      totalDatasets: allDatasets.length,
      calculatedCount: allDatasets.length,
      blockedCount: 0,
      averageScore,
      datasets: datasetIndices,
      lowUtilizationDatasets,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
