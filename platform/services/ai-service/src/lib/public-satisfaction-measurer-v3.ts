// Design Ref: §설계결정 — AI기반 공공 서비스 만족도 측정 v3
// Plan SC: FR-R578.1~5
import { createHash } from 'crypto'

interface ServiceRecord { serviceId: string; name: string }
interface SatisfactionEntry { maskedUserId: string; score: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PublicSatisfactionMeasurerV3 {
  private services = new Map<string, ServiceRecord>()
  private ratings = new Map<string, SatisfactionEntry[]>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string): void {
    this.services.set(serviceId, { serviceId, name })
    this.ratings.set(serviceId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SERVICE', details: { serviceId, name } })
  }

  recordSatisfaction(serviceId: string, userId: string, score: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const maskedUserId = createHash('sha256').update(userId).digest('hex').substring(0, 16)
    const entries = this.ratings.get(serviceId) ?? []
    entries.push({ maskedUserId, score })
    this.ratings.set(serviceId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_SATISFACTION', details: { serviceId, maskedUserId, score } })
  }

  getAverageSatisfaction(serviceId: string): number {
    const entries = this.ratings.get(serviceId) ?? []
    if (entries.length === 0) return 0
    return entries.reduce((sum, e) => sum + e.score, 0) / entries.length
  }

  getLowSatisfactionServices(): ServiceRecord[] {
    return Array.from(this.services.values()).filter(s => this.getAverageSatisfaction(s.serviceId) < 3.0)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
