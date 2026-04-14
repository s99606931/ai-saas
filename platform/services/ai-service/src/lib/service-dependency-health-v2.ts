// Design Ref: §건강 점수 — ServiceDependencyHealthV2
// Plan SC: SVC-AI-ADV-R504

interface ServiceNode {
  serviceId: string
  name: string
  version: string
}

interface DependencyRecord {
  serviceId: string
  dependencyId: string
  latencyMs: number
  errorRate: number
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  details?: Record<string, unknown>
}

export class ServiceDependencyHealthV2 {
  private services = new Map<string, ServiceNode>()
  private healthRecords = new Map<string, DependencyRecord>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string, version: string): ServiceNode {
    const service: ServiceNode = { serviceId, name, version }
    this.services.set(serviceId, service)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SERVICE',
      serviceId,
      details: { name, version },
    })
    return service
  }

  recordDependencyHealth(
    serviceId: string,
    dependencyId: string,
    latencyMs: number,
    errorRate: number,
    dataGrade?: string
  ): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`)
    const key = `${serviceId}:${dependencyId}`
    this.healthRecords.set(key, { serviceId, dependencyId, latencyMs, errorRate })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_DEPENDENCY_HEALTH',
      serviceId,
      details: { dependencyId, latencyMs, errorRate },
    })
  }

  getHealthScore(serviceId: string, dependencyId: string): number {
    const key = `${serviceId}:${dependencyId}`
    const record = this.healthRecords.get(key)
    if (!record) return 100
    return Math.max(0, 100 - record.latencyMs / 10 - record.errorRate * 2)
  }

  getUnhealthyDependencies(serviceId: string): DependencyRecord[] {
    return Array.from(this.healthRecords.values()).filter(
      (r) => r.serviceId === serviceId && this.getHealthScore(r.serviceId, r.dependencyId) < 60
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
