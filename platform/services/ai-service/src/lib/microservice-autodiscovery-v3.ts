// Design Ref: §설계결정 — AI기반 마이크로서비스 자동 발견 v3
// Plan SC: FR-R624.1~5

interface ServiceInstance { instanceId: string; serviceName: string; host: string; port: number; healthy: boolean; lastSeen: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class MicroserviceAutodiscoveryV3 {
  private instances = new Map<string, ServiceInstance>()
  private auditLog: AuditEntry[] = []

  registerInstance(instanceId: string, serviceName: string, host: string, port: number): void {
    this.instances.set(instanceId, { instanceId, serviceName, host, port, healthy: true, lastSeen: new Date().toISOString() })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_INSTANCE', details: { instanceId, serviceName, host, port } })
  }

  updateHealth(instanceId: string, healthy: boolean, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const inst = this.instances.get(instanceId)
    if (inst) this.instances.set(instanceId, { ...inst, healthy, lastSeen: new Date().toISOString() })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'UPDATE_HEALTH', details: { instanceId, healthy } })
  }

  getHealthyInstances(serviceName: string): ServiceInstance[] {
    return Array.from(this.instances.values()).filter(i => i.serviceName === serviceName && i.healthy)
  }

  getUnhealthyInstances(): ServiceInstance[] {
    return Array.from(this.instances.values()).filter(i => !i.healthy)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
