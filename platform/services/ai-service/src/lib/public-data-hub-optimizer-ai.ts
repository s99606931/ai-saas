// Design Ref: §클래스 설계 — PublicDataHubOptimizerAi
// Plan SC: SVC-AI-ADV-R533

interface DataSource {
  sourceId: string
  name: string
  category: string
  dataVolumeGB: number
}

interface AccessPattern {
  accessCount: number
  avgLatencyMs: number
}

interface AuditEntry {
  timestamp: string
  action: string
  sourceId: string
  details?: Record<string, unknown>
}

export class PublicDataHubOptimizerAi {
  private sources = new Map<string, DataSource>()
  private patterns = new Map<string, AccessPattern>()
  private auditLog: AuditEntry[] = []

  registerSource(sourceId: string, name: string, category: string, dataVolumeGB: number): DataSource {
    const source: DataSource = { sourceId, name, category, dataVolumeGB }
    this.sources.set(sourceId, source)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SOURCE', sourceId, details: { name, category, dataVolumeGB } })
    return source
  }

  recordAccessPattern(sourceId: string, accessCount: number, avgLatencyMs: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.sources.has(sourceId)) throw new Error(`소스를 찾을 수 없습니다: ${sourceId}`)
    this.patterns.set(sourceId, { accessCount, avgLatencyMs })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_ACCESS_PATTERN', sourceId, details: { accessCount, avgLatencyMs } })
  }

  getOptimizationScore(sourceId: string): number {
    const pattern = this.patterns.get(sourceId)
    if (!pattern) return 0
    return (pattern.accessCount * 10) / (pattern.avgLatencyMs + 1)
  }

  getOptimizationPriority(): DataSource[] {
    return Array.from(this.sources.values()).sort(
      (a, b) => this.getOptimizationScore(b.sourceId) - this.getOptimizationScore(a.sourceId)
    )
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
