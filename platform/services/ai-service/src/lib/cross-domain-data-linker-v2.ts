// Design Ref: §설계결정 — AI기반 도메인 간 데이터 연계 v2
// Plan SC: FR-R634.1~5

interface DomainRecord { domainId: string; name: string }
interface LinkRecord { sourceDomain: string; targetDomain: string; matched: boolean }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class CrossDomainDataLinkerV2 {
  private domains = new Map<string, DomainRecord>()
  private links: LinkRecord[] = []
  private auditLog: AuditEntry[] = []

  registerDomain(domainId: string, name: string): void {
    this.domains.set(domainId, { domainId, name })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_DOMAIN', details: { domainId } })
  }

  addLink(sourceDomain: string, targetDomain: string, matched: boolean, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.domains.has(sourceDomain) || !this.domains.has(targetDomain)) {
      throw new Error('DOMAIN_NOT_FOUND')
    }
    this.links.push({ sourceDomain, targetDomain, matched })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'ADD_LINK', details: { sourceDomain, targetDomain, matched } })
  }

  matchRate(sourceDomain: string, targetDomain: string): number {
    const relevant = this.links.filter(l => l.sourceDomain === sourceDomain && l.targetDomain === targetDomain)
    if (relevant.length === 0) return 0
    const matched = relevant.filter(l => l.matched).length
    return matched / relevant.length
  }

  lowMatchDomains(threshold: number): Array<{ source: string; target: string; rate: number }> {
    const pairs = new Map<string, { source: string; target: string; rate: number }>()
    for (const link of this.links) {
      const key = `${link.sourceDomain}|${link.targetDomain}`
      if (!pairs.has(key)) {
        pairs.set(key, { source: link.sourceDomain, target: link.targetDomain, rate: this.matchRate(link.sourceDomain, link.targetDomain) })
      }
    }
    return Array.from(pairs.values()).filter(p => p.rate < threshold)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
