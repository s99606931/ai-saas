// Design Ref: §설계결정 — AI기반 공공기관 서비스 성과 예측 v2
// Plan SC: FR-R574.1~5
// import { createHash } from 'crypto' // NOTE: 미사용, PII 마스킹 불필요 모듈

interface ServiceRecord { serviceId: string; name: string; category: string }
interface PerformanceEntry { score: number; period: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ServicePerformancePredictorV2 {
  private services = new Map<string, ServiceRecord>()
  private performances = new Map<string, PerformanceEntry[]>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string, category: string): void {
    this.services.set(serviceId, { serviceId, name, category })
    this.performances.set(serviceId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SERVICE', details: { serviceId, name } })
  }

  recordPerformance(serviceId: string, score: number, period: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const entries = this.performances.get(serviceId) ?? []
    entries.push({ score, period })
    this.performances.set(serviceId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_PERFORMANCE', details: { serviceId, score, period } })
  }

  getPredictedScore(serviceId: string): number {
    const entries = this.performances.get(serviceId) ?? []
    if (entries.length === 0) return 0
    const recent = entries.slice(-3)
    return recent.reduce((sum, e) => sum + e.score, 0) / recent.length
  }

  getLowPerformanceServices(): ServiceRecord[] {
    return Array.from(this.services.values()).filter(s => this.getPredictedScore(s.serviceId) < 60)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
