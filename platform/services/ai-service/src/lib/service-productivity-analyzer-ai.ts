// Design Ref: §클래스 설계 — ServiceProductivityAnalyzerAi
// Plan SC: SVC-AI-ADV-R555

interface ProductivityService {
  serviceId: string
  name: string
  teamSize: number
}

interface AuditEntry { timestamp: string; action: string; serviceId: string; details?: Record<string, unknown> }

export class ServiceProductivityAnalyzerAi {
  private services = new Map<string, ProductivityService>()
  private metrics = new Map<string, { requestsHandled: number; defectsFixed: number }>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string, teamSize: number): ProductivityService {
    const svc: ProductivityService = { serviceId, name, teamSize }
    this.services.set(serviceId, svc)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SERVICE', serviceId, details: { name, teamSize } })
    return svc
  }

  recordMetrics(serviceId: string, requestsHandled: number, defectsFixed: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.services.has(serviceId)) throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`)
    const existing = this.metrics.get(serviceId)
    this.metrics.set(serviceId, {
      requestsHandled: (existing?.requestsHandled ?? 0) + requestsHandled,
      defectsFixed: (existing?.defectsFixed ?? 0) + defectsFixed,
    })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_METRICS', serviceId, details: { requestsHandled, defectsFixed } })
  }

  getProductivityScore(serviceId: string): number {
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`)
    if (svc.teamSize === 0) return 0
    const m = this.metrics.get(serviceId)
    if (!m) return 0
    return (m.requestsHandled + m.defectsFixed * 2) / svc.teamSize
  }

  getLowProductivityServices(): ProductivityService[] {
    return Array.from(this.services.values()).filter(svc => this.getProductivityScore(svc.serviceId) < 10)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
