// Design Ref: §R523 — AI기반 자동 인프라 프로비저닝 최적화
// Plan SC: SVC-AI-ADV-R523-SC01

export type ResourceType = 'COMPUTE' | 'STORAGE' | 'NETWORK' | 'DATABASE' | 'CACHE'
export type ProvisioningAction = 'SCALE_UP' | 'SCALE_DOWN' | 'SCALE_OUT' | 'SCALE_IN' | 'KEEP'
export type CloudProvider = 'ON_PREM' | 'KT_CLOUD' | 'NAVER_CLOUD' | 'NHN_CLOUD'

export interface ResourceSpec {
  resourceId: string
  serviceId: string
  resourceType: ResourceType
  provider: CloudProvider
  currentCpuPct: number
  currentMemoryPct: number
  currentStoragePct: number
  currentCostKrwPerHour: number
  requestedCpuPct: number    // 실제 요청 기준 CPU 사용률
  requestedMemoryPct: number
}

export interface ProvisioningRecommendation {
  resourceId: string
  serviceId: string
  resourceType: ResourceType
  action: ProvisioningAction
  reason: string
  estimatedSavingKrw: number
  estimatedNewCostKrwPerHour: number
  urgency: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface ProvisioningOptimizationReport {
  totalResources: number
  recommendations: ProvisioningRecommendation[]
  estimatedMonthlySavingKrw: number
  overProvisionedCount: number
  underProvisionedCount: number
}

interface AuditEntry {
  timestamp: string
  action: string
  resourceId: string
  detail: Record<string, unknown>
}

export class InfraProvisioningOptimizerAI {
  private resources = new Map<string, ResourceSpec>()
  private auditLog: AuditEntry[] = []

  registerResource(resource: ResourceSpec): void {
    this.resources.set(resource.resourceId, resource)
    this.appendAudit('resource.register', resource.resourceId, { serviceId: resource.serviceId, type: resource.resourceType })
  }

  optimize(): ProvisioningOptimizationReport {
    const allResources = Array.from(this.resources.values())
    this.appendAudit('provisioning.optimize', 'system', { resourceCount: allResources.length })

    const recommendations: ProvisioningRecommendation[] = []
    let overProvisionedCount = 0
    let underProvisionedCount = 0

    for (const res of allResources) {
      const avgUsagePct = (res.requestedCpuPct + res.requestedMemoryPct) / 2

      if (avgUsagePct < 20 && res.currentCpuPct < 20) {
        // 과잉 프로비저닝: 사용률 20% 미만 → SCALE_DOWN
        overProvisionedCount++
        const saving = res.currentCostKrwPerHour * 0.4
        recommendations.push({
          resourceId: res.resourceId,
          serviceId: res.serviceId,
          resourceType: res.resourceType,
          action: 'SCALE_DOWN',
          reason: `CPU/메모리 사용률 ${avgUsagePct.toFixed(0)}% — 과잉 프로비저닝`,
          estimatedSavingKrw: Math.round(saving * 720),
          estimatedNewCostKrwPerHour: Math.round(res.currentCostKrwPerHour * 0.6),
          urgency: 'LOW',
        })
      } else if (avgUsagePct > 80 || res.currentCpuPct > 85) {
        // 부족 프로비저닝: 사용률 80% 초과 → SCALE_UP or SCALE_OUT
        underProvisionedCount++
        const action: ProvisioningAction = res.resourceType === 'COMPUTE' ? 'SCALE_OUT' : 'SCALE_UP'
        recommendations.push({
          resourceId: res.resourceId,
          serviceId: res.serviceId,
          resourceType: res.resourceType,
          action,
          reason: `CPU/메모리 사용률 ${avgUsagePct.toFixed(0)}% — 용량 부족 위험`,
          estimatedSavingKrw: 0,
          estimatedNewCostKrwPerHour: Math.round(res.currentCostKrwPerHour * 1.5),
          urgency: res.currentCpuPct > 95 ? 'HIGH' : 'MEDIUM',
        })
      } else if (avgUsagePct < 40 && res.currentStoragePct < 30) {
        // 스토리지 과잉
        overProvisionedCount++
        const saving = res.currentCostKrwPerHour * 0.2
        recommendations.push({
          resourceId: res.resourceId,
          serviceId: res.serviceId,
          resourceType: res.resourceType,
          action: 'SCALE_IN',
          reason: `스토리지 사용률 ${res.currentStoragePct}% — 축소 가능`,
          estimatedSavingKrw: Math.round(saving * 720),
          estimatedNewCostKrwPerHour: Math.round(res.currentCostKrwPerHour * 0.8),
          urgency: 'LOW',
        })
      }
    }

    const estimatedMonthlySavingKrw = recommendations.reduce((s, r) => s + r.estimatedSavingKrw, 0)

    return { totalResources: allResources.length, recommendations, estimatedMonthlySavingKrw, overProvisionedCount, underProvisionedCount }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, resourceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, resourceId, detail })
  }
}
