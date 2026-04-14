// Design Ref: §R559 — AI기반 클라우드 비용 최적화 에이전트 v2
// Plan SC: SVC-AI-ADV-R559-SC01

export type CloudResourceType = 'VM' | 'CONTAINER' | 'STORAGE' | 'DATABASE' | 'NETWORK'
export type OptimizationAction = 'TERMINATE' | 'DOWNSIZE' | 'RESERVE' | 'KEEP'

export interface CloudResource {
  resourceId: string
  serviceId: string
  resourceType: CloudResourceType
  provider: 'ON_PREM' | 'KT_CLOUD' | 'NAVER_CLOUD' | 'NHN_CLOUD'
  cpuUsagePct: number
  memoryUsagePct: number
  storageUsagePct: number
  costKrwPerHour: number
  isReserved: boolean
  uptimeDays: number
}

export interface CostOptimizationRecommendation {
  resourceId: string
  serviceId: string
  resourceType: CloudResourceType
  action: OptimizationAction
  reason: string
  estimatedMonthlySavingKrw: number
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface CostOptimizationReport {
  totalResources: number
  idleCount: number
  underutilizedCount: number
  recommendations: CostOptimizationRecommendation[]
  totalEstimatedMonthlySavingKrw: number
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  resourceId: string
  detail: Record<string, unknown>
}

export class CloudCostOptimizationAgentV2 {
  private resources = new Map<string, CloudResource>()
  private auditLog: AuditEntry[] = []

  registerResource(resource: CloudResource): void {
    this.resources.set(resource.resourceId, resource)
    this.appendAudit('resource.register', resource.resourceId, { serviceId: resource.serviceId, type: resource.resourceType })
  }

  analyze(): CostOptimizationReport {
    const allResources = Array.from(this.resources.values())
    this.appendAudit('cost.analyze', 'system', { resourceCount: allResources.length })

    const recommendations: CostOptimizationRecommendation[] = []
    let idleCount = 0
    let underutilizedCount = 0

    for (const res of allResources) {
      const rec = this.evaluateResource(res)
      if (rec) {
        recommendations.push(rec)
        if (rec.action === 'TERMINATE') idleCount++
        else if (rec.action === 'DOWNSIZE') underutilizedCount++
      }
    }

    const totalEstimatedMonthlySavingKrw = recommendations.reduce((s, r) => s + r.estimatedMonthlySavingKrw, 0)

    return {
      totalResources: allResources.length,
      idleCount,
      underutilizedCount,
      recommendations,
      totalEstimatedMonthlySavingKrw,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private evaluateResource(res: CloudResource): CostOptimizationRecommendation | null {
    const monthlyHours = 720

    // 유휴 자원: CPU<10% AND memory<15%
    if (res.cpuUsagePct < 10 && res.memoryUsagePct < 15) {
      return {
        resourceId: res.resourceId,
        serviceId: res.serviceId,
        resourceType: res.resourceType,
        action: 'TERMINATE',
        reason: `유휴 자원 — CPU ${res.cpuUsagePct}%, 메모리 ${res.memoryUsagePct}% (TERMINATE 권고)`,
        estimatedMonthlySavingKrw: Math.round(res.costKrwPerHour * monthlyHours),
        priority: 'HIGH',
      }
    }

    // 저활용 자원: CPU<30%
    if (res.cpuUsagePct < 30 && res.memoryUsagePct < 40) {
      return {
        resourceId: res.resourceId,
        serviceId: res.serviceId,
        resourceType: res.resourceType,
        action: 'DOWNSIZE',
        reason: `저활용 자원 — CPU ${res.cpuUsagePct}% (DOWNSIZE 권고)`,
        estimatedMonthlySavingKrw: Math.round(res.costKrwPerHour * 0.4 * monthlyHours),
        priority: 'MEDIUM',
      }
    }

    // 예약 인스턴스 미적용: 장기 운영 자원
    if (!res.isReserved && res.uptimeDays > 90 && res.cpuUsagePct >= 30) {
      return {
        resourceId: res.resourceId,
        serviceId: res.serviceId,
        resourceType: res.resourceType,
        action: 'RESERVE',
        reason: `예약 인스턴스 미적용 — ${res.uptimeDays}일 운영 중 (예약으로 30% 절감 가능)`,
        estimatedMonthlySavingKrw: Math.round(res.costKrwPerHour * 0.3 * monthlyHours),
        priority: 'LOW',
      }
    }

    return null
  }

  private appendAudit(action: string, resourceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, resourceId, detail })
  }
}
