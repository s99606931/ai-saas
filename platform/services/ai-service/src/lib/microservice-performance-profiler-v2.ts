// Design Ref: §성능 점수 공식 — MicroservicePerformanceProfilerV2
// Plan SC: SVC-AI-ADV-R501

import { createHash } from 'crypto'

interface MicroService {
  serviceId: string
  name: string
  version: string
}

interface PerformanceMetric {
  cpuPercent: number
  memPercent: number
  requestsPerSec: number
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  maskedServiceId?: string
  details?: Record<string, unknown>
}

export class MicroservicePerformanceProfilerV2 {
  private services = new Map<string, MicroService>()
  private metrics = new Map<string, PerformanceMetric>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string, version: string): MicroService {
    const service: MicroService = { serviceId, name, version }
    this.services.set(serviceId, service)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SERVICE',
      serviceId,
      details: { name, version },
    })
    return service
  }

  recordMetrics(
    serviceId: string,
    cpuPercent: number,
    memPercent: number,
    requestsPerSec: number,
    dataGrade?: string
  ): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`)
    this.metrics.set(serviceId, { cpuPercent, memPercent, requestsPerSec })
    const maskedServiceId = createHash('sha256').update(serviceId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_METRICS',
      serviceId,
      maskedServiceId,
      details: { cpuPercent, memPercent, requestsPerSec },
    })
  }

  getPerformanceScore(serviceId: string): number {
    const metric = this.metrics.get(serviceId)
    if (!metric) return 100
    const { cpuPercent, memPercent, requestsPerSec } = metric
    return Math.max(
      0,
      100 - cpuPercent * 0.4 - memPercent * 0.3 - Math.max(0, requestsPerSec - 100) * 0.1
    )
  }

  getLowPerformanceServices(): MicroService[] {
    return Array.from(this.services.values()).filter(
      (svc) => this.getPerformanceScore(svc.serviceId) < 60
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
