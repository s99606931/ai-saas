// Design Ref: §설계결정 — AI기반 서비스 장애 자동 격리 v3
// Plan SC: FR-R593.1~5

interface ServiceEntry { serviceId: string; name: string; tier: string; isolated: boolean }
interface FaultRecord { faultId: string; serviceId: string; errorRate: number; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ServiceFaultIsolatorV3 {
  private services = new Map<string, ServiceEntry>()
  private faults = new Map<string, FaultRecord>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string, tier: string): void {
    this.services.set(serviceId, { serviceId, name, tier, isolated: false })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SERVICE', details: { serviceId, name } })
  }

  recordFault(faultId: string, serviceId: string, errorRate: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.faults.set(faultId, { faultId, serviceId, errorRate, timestamp: new Date().toISOString() })
    if (errorRate > 50) {
      const svc = this.services.get(serviceId)
      if (svc) this.services.set(serviceId, { ...svc, isolated: true })
    }
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_FAULT', details: { faultId, serviceId, errorRate } })
  }

  isIsolated(serviceId: string): boolean {
    return this.services.get(serviceId)?.isolated ?? false
  }

  getIsolatedServices(): ServiceEntry[] {
    return Array.from(this.services.values()).filter(s => s.isolated)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
