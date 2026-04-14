// Design Ref: §설계결정 — AI기반 공공 서비스 추천 v4
// Plan SC: FR-R597.1~5
import { createHash } from 'crypto'

interface ServiceItem { serviceId: string; name: string; tags: string[] }
interface UserInteraction { serviceId: string; score: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PublicServiceRecommenderV4 {
  private services = new Map<string, ServiceItem>()
  private interactions = new Map<string, UserInteraction[]>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string, tags: string[]): void {
    this.services.set(serviceId, { serviceId, name, tags })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SERVICE', details: { serviceId, name } })
  }

  recordInteraction(userId: string, serviceId: string, score: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const maskedUserId = createHash('sha256').update(userId).digest('hex').substring(0, 16)
    const entries = this.interactions.get(maskedUserId) ?? []
    entries.push({ serviceId, score })
    this.interactions.set(maskedUserId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_INTERACTION', details: { maskedUserId, serviceId, score } })
  }

  getTopServices(limit: number): ServiceItem[] {
    const scoreSums = new Map<string, number>()
    for (const interactions of this.interactions.values()) {
      for (const i of interactions) {
        scoreSums.set(i.serviceId, (scoreSums.get(i.serviceId) ?? 0) + i.score)
      }
    }
    return Array.from(this.services.values())
      .sort((a, b) => (scoreSums.get(b.serviceId) ?? 0) - (scoreSums.get(a.serviceId) ?? 0))
      .slice(0, limit)
  }

  getRecommendationCount(): number {
    return this.services.size
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
