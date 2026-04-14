// Design Ref: §설계결정 — AI기반 실시간 API 모니터링 v2
// Plan SC: FR-R595.1~5

interface ApiEndpoint { endpointId: string; path: string; method: string }
interface ApiMetric { latencyMs: number; statusCode: number; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ApiMonitoringV2 {
  private endpoints = new Map<string, ApiEndpoint>()
  private metrics = new Map<string, ApiMetric[]>()
  private auditLog: AuditEntry[] = []

  registerEndpoint(endpointId: string, path: string, method: string): void {
    this.endpoints.set(endpointId, { endpointId, path, method })
    this.metrics.set(endpointId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_ENDPOINT', details: { endpointId, path, method } })
  }

  recordMetric(endpointId: string, latencyMs: number, statusCode: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const entries = this.metrics.get(endpointId) ?? []
    entries.push({ latencyMs, statusCode, timestamp: new Date().toISOString() })
    this.metrics.set(endpointId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_METRIC', details: { endpointId, latencyMs, statusCode } })
  }

  getAverageLatency(endpointId: string): number {
    const entries = this.metrics.get(endpointId) ?? []
    if (entries.length === 0) return 0
    return entries.reduce((sum, e) => sum + e.latencyMs, 0) / entries.length
  }

  getErrorRate(endpointId: string): number {
    const entries = this.metrics.get(endpointId) ?? []
    if (entries.length === 0) return 0
    const errors = entries.filter(e => e.statusCode >= 500).length
    return (errors / entries.length) * 100
  }

  getHighLatencyEndpoints(thresholdMs: number): ApiEndpoint[] {
    return Array.from(this.endpoints.values()).filter(e => this.getAverageLatency(e.endpointId) > thresholdMs)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
