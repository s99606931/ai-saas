// Design Ref: §낭비 비용 — MulticloudResourceOptimizerV2
// Plan SC: SVC-AI-ADV-R507

interface CloudResource {
  resourceId: string
  provider: string
  resourceType: string
  monthlyCost: number
}

interface AuditEntry {
  timestamp: string
  action: string
  resourceId: string
  details?: Record<string, unknown>
}

export class MulticloudResourceOptimizerV2 {
  private resources = new Map<string, CloudResource>()
  private utilizations = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerResource(
    resourceId: string,
    provider: string,
    resourceType: string,
    monthlyCost: number
  ): CloudResource {
    const resource: CloudResource = { resourceId, provider, resourceType, monthlyCost }
    this.resources.set(resourceId, resource)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_RESOURCE',
      resourceId,
      details: { provider, resourceType, monthlyCost },
    })
    return resource
  }

  recordUtilization(resourceId: string, utilizationPercent: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.resources.has(resourceId)) throw new Error(`리소스를 찾을 수 없습니다: ${resourceId}`)
    this.utilizations.set(resourceId, utilizationPercent)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_UTILIZATION',
      resourceId,
      details: { utilizationPercent },
    })
  }

  getWastedCost(resourceId: string): number {
    const resource = this.resources.get(resourceId)
    if (!resource) throw new Error(`리소스를 찾을 수 없습니다: ${resourceId}`)
    const utilization = this.utilizations.get(resourceId) ?? 0
    return resource.monthlyCost * (1 - utilization / 100)
  }

  getOptimizationTargets(): CloudResource[] {
    return Array.from(this.resources.values()).filter((r) => {
      const utilization = this.utilizations.get(r.resourceId) ?? 0
      return utilization < 30
    })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
