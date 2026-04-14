// Design Ref: SVC-AI-ADV-R623 — AI기반 멀티클라우드 네트워크 최적화 v3 (impl v4)
// Plan SC: FR-R623.1~5
import { createHash } from 'crypto'

interface NetworkLink {
  linkId: string
  source: string
  destination: string
  latencyMs: number
  bandwidthMbps: number
  costPerGB: number
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

type LinkStatus = 'OPTIMAL' | 'ACCEPTABLE' | 'BOTTLENECK'

interface LinkAnalysis {
  linkId: string
  score: number
  status: LinkStatus
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class MulticloudNetworkOptimizerV4 {
  private links = new Map<string, NetworkLink>()
  private auditLog: AuditEntry[] = []

  registerLink(link: NetworkLink, dataGrade?: 'C' | 'S' | 'O'): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.links.set(link.linkId, { ...link })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_LINK',
      actor: maskPII(link.linkId),
      details: { source: link.source, destination: link.destination },
    })
  }

  analyze(linkId: string): LinkAnalysis | null {
    const link = this.links.get(linkId)
    if (!link) return null
    // Composite score: low latency + high bandwidth + low cost
    const latencyScore = Math.max(0, 1 - link.latencyMs / 1000)
    const bandwidthScore = Math.min(1, link.bandwidthMbps / 1000)
    const costScore = Math.max(0, 1 - link.costPerGB / 1)
    const score = Math.round((latencyScore * 0.5 + bandwidthScore * 0.3 + costScore * 0.2) * 100) / 100

    let status: LinkStatus
    if (score >= 0.7) status = 'OPTIMAL'
    else if (score >= 0.4) status = 'ACCEPTABLE'
    else status = 'BOTTLENECK'

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_LINK',
      actor: maskPII(linkId),
      details: { score, status },
    })

    return { linkId, score, status }
  }

  getBestLink(source: string, destination: string): LinkAnalysis | null {
    const candidates = Array.from(this.links.values()).filter(
      (l) => l.source === source && l.destination === destination,
    )
    if (candidates.length === 0) return null
    const analyses = candidates
      .map((l) => this.analyze(l.linkId))
      .filter((a): a is LinkAnalysis => a !== null)
    analyses.sort((a, b) => b.score - a.score)
    return analyses[0] ?? null
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
