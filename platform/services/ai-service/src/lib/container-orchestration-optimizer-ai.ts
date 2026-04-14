// Design Ref: §설계결정 — AI기반 자동 컨테이너 오케스트레이션 최적화
// Plan SC: FR-R579.1~5

interface ContainerRecord { containerId: string; name: string; requestedCpu: number; requestedMemory: number }
interface ResourceUsage { cpuUsage: number; memUsage: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ContainerOrchestrationOptimizerAi {
  private containers = new Map<string, ContainerRecord>()
  private usages = new Map<string, ResourceUsage>()
  private auditLog: AuditEntry[] = []

  registerContainer(containerId: string, name: string, requestedCpu: number, requestedMemory: number): void {
    this.containers.set(containerId, { containerId, name, requestedCpu, requestedMemory })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_CONTAINER', details: { containerId, name } })
  }

  recordUsage(containerId: string, cpuUsage: number, memUsage: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.usages.set(containerId, { cpuUsage, memUsage })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_USAGE', details: { containerId, cpuUsage, memUsage } })
  }

  getOptimizationRecommendation(containerId: string): string {
    const usage = this.usages.get(containerId)
    if (!usage) return 'no-data'
    const avgUsage = (usage.cpuUsage + usage.memUsage) / 2
    if (avgUsage < 50) return 'over-provisioned'
    if (avgUsage > 90) return 'under-provisioned'
    return 'optimal'
  }

  getOverProvisionedContainers(): ContainerRecord[] {
    return Array.from(this.containers.values()).filter(
      c => this.getOptimizationRecommendation(c.containerId) === 'over-provisioned'
    )
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
