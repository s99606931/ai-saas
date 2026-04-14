// Design Ref: §클래스 설계 — ServiceContinuityAssurerAi
// Plan SC: SVC-AI-ADV-R529

interface ContinuityService {
  serviceId: string
  name: string
  rto: number
  rpo: number
}

interface OutageRecord {
  duration: number
  impact: number
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  details?: Record<string, unknown>
}

export class ServiceContinuityAssurerAi {
  private services = new Map<string, ContinuityService>()
  private outages = new Map<string, OutageRecord[]>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string, rto: number, rpo: number): ContinuityService {
    const svc: ContinuityService = { serviceId, name, rto, rpo }
    this.services.set(serviceId, svc)
    this.outages.set(serviceId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SERVICE', serviceId, details: { name, rto, rpo } })
    return svc
  }

  recordOutage(serviceId: string, duration: number, impact: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.services.has(serviceId)) throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`)
    this.outages.get(serviceId)!.push({ duration, impact })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_OUTAGE', serviceId, details: { duration, impact } })
  }

  getContinuityScore(serviceId: string): number {
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`)
    const records = this.outages.get(serviceId) ?? []
    if (records.length === 0) return 100
    const totalDuration = records.reduce((s, r) => s + r.duration, 0)
    const totalImpact = records.reduce((s, r) => s + r.impact, 0)
    return Math.max(0, 100 - (totalDuration / svc.rto) * 50 - totalImpact * 10)
  }

  getAtRiskServices(): ContinuityService[] {
    return Array.from(this.services.values()).filter(svc => this.getContinuityScore(svc.serviceId) < 60)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
