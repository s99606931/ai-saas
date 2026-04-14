// Design Ref: §설계결정 — AI기반 서비스 카탈로그 자동화 v3
// Plan SC: FR-R632.1~5

interface CatalogEntry {
  serviceId: string
  name: string
  category: string
  confidence: number
  metadata: Record<string, string>
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ServiceCatalogAiV3 {
  private entries = new Map<string, CatalogEntry>()
  private auditLog: AuditEntry[] = []

  register(serviceId: string, name: string, category: string, confidence: number): void {
    this.entries.set(serviceId, { serviceId, name, category, confidence, metadata: {} })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_ENTRY', details: { serviceId, category } })
  }

  updateMetadata(serviceId: string, metadata: Record<string, string>, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const entry = this.entries.get(serviceId)
    if (!entry) throw new Error('ENTRY_NOT_FOUND')
    entry.metadata = { ...entry.metadata, ...metadata }
    this.entries.set(serviceId, entry)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'UPDATE_METADATA', details: { serviceId } })
  }

  findByCategory(category: string): CatalogEntry[] {
    return Array.from(this.entries.values()).filter(e => e.category === category)
  }

  recommend(topN: number): CatalogEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topN)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
