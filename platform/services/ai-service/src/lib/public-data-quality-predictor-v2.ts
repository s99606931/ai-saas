// Design Ref: §설계결정 — AI기반 공공기관 데이터 품질 예측 v2
// Plan SC: FR-R594.1~5

interface DatasetRecord { datasetId: string; name: string; category: string }
interface QualityEntry { completeness: number; accuracy: number; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PublicDataQualityPredictorV2 {
  private datasets = new Map<string, DatasetRecord>()
  private qualities = new Map<string, QualityEntry[]>()
  private auditLog: AuditEntry[] = []

  registerDataset(datasetId: string, name: string, category: string): void {
    this.datasets.set(datasetId, { datasetId, name, category })
    this.qualities.set(datasetId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_DATASET', details: { datasetId, name } })
  }

  recordQuality(datasetId: string, completeness: number, accuracy: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const entries = this.qualities.get(datasetId) ?? []
    entries.push({ completeness, accuracy, timestamp: new Date().toISOString() })
    this.qualities.set(datasetId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_QUALITY', details: { datasetId, completeness, accuracy } })
  }

  getQualityScore(datasetId: string): number {
    const entries = this.qualities.get(datasetId) ?? []
    if (entries.length === 0) return 0
    const recent = entries[entries.length - 1]!
    return (recent.completeness + recent.accuracy) / 2
  }

  getLowQualityDatasets(): DatasetRecord[] {
    return Array.from(this.datasets.values()).filter(d => this.getQualityScore(d.datasetId) < 70)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
