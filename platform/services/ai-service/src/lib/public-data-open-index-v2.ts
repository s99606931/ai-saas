// Design Ref: §클래스 설계 — PublicDataOpenIndexV2
// Plan SC: SVC-AI-ADV-R549

interface Dataset {
  datasetId: string
  name: string
  agency: string
  totalRecords: number
}

interface OpenRecord {
  openRecords: number
  formats: string[]
}

interface AuditEntry { timestamp: string; action: string; datasetId: string; details?: Record<string, unknown> }

export class PublicDataOpenIndexV2 {
  private datasets = new Map<string, Dataset>()
  private openData = new Map<string, OpenRecord>()
  private auditLog: AuditEntry[] = []

  registerDataset(datasetId: string, name: string, agency: string, totalRecords: number): Dataset {
    const dataset: Dataset = { datasetId, name, agency, totalRecords }
    this.datasets.set(datasetId, dataset)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_DATASET', datasetId, details: { name, agency, totalRecords } })
    return dataset
  }

  recordOpenData(datasetId: string, openRecords: number, formats: string[], dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.datasets.has(datasetId)) throw new Error(`데이터셋을 찾을 수 없습니다: ${datasetId}`)
    this.openData.set(datasetId, { openRecords, formats })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_OPEN_DATA', datasetId, details: { openRecords, formatCount: formats.length } })
  }

  getOpenIndex(datasetId: string): number {
    const dataset = this.datasets.get(datasetId)
    if (!dataset) throw new Error(`데이터셋을 찾을 수 없습니다: ${datasetId}`)
    if (dataset.totalRecords === 0) return 100
    const open = this.openData.get(datasetId)
    if (!open) return 0
    return (open.openRecords / dataset.totalRecords) * 100
  }

  getLowOpenDatasets(): Dataset[] {
    return Array.from(this.datasets.values()).filter(d => this.getOpenIndex(d.datasetId) < 50)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
