// Design Ref: §설계결정 — AI기반 멀티클라우드 네트워크 최적화 v3
// Plan SC: FR-R623.1~5

interface NetworkLink { linkId: string; source: string; target: string; provider: string }
interface LinkMetric { bandwidthMbps: number; latencyMs: number; costPerGb: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class MulticloudNetworkOptimizerV3 {
  private links = new Map<string, NetworkLink>()
  private metrics = new Map<string, LinkMetric>()
  private auditLog: AuditEntry[] = []

  registerLink(linkId: string, source: string, target: string, provider: string): void {
    this.links.set(linkId, { linkId, source, target, provider })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_LINK', details: { linkId, source, target, provider } })
  }

  recordMetrics(linkId: string, bandwidthMbps: number, latencyMs: number, costPerGb: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.metrics.set(linkId, { bandwidthMbps, latencyMs, costPerGb })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_METRICS', details: { linkId, bandwidthMbps, latencyMs, costPerGb } })
  }

  getEfficiencyScore(linkId: string): number {
    const m = this.metrics.get(linkId)
    if (!m) return 0
    // higher bandwidth, lower latency, lower cost = better score
    return Math.max(0, (m.bandwidthMbps / 10) - (m.latencyMs / 10) - m.costPerGb)
  }

  getLowEfficiencyLinks(threshold: number): NetworkLink[] {
    return Array.from(this.links.values()).filter(l => this.getEfficiencyScore(l.linkId) < threshold)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
