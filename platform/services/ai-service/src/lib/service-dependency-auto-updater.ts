// Design Ref: §R331 — AI기반 서비스 종속성 자동 업데이트
// Plan SC: SC-R331

export interface DependencyPackage {
  packageId: string
  name: string
  currentVersion: string
  latestVersion: string
  hasSecurityPatch: boolean
  breakingChange: boolean
  licenseCompatible: boolean
}

export interface ServiceDependencies {
  serviceId: string
  serviceName: string
  packages: DependencyPackage[]
}

export type UpdateAction = 'AUTO_UPDATE' | 'MANUAL_REVIEW' | 'BLOCK' | 'SKIP'

export interface UpdateRecommendation {
  packageId: string
  name: string
  currentVersion: string
  targetVersion: string
  action: UpdateAction
  reason: string
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface UpdatePlan {
  serviceId: string
  recommendations: UpdateRecommendation[]
  autoUpdateCount: number
  manualReviewCount: number
  blockedCount: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceDependencyAutoUpdater {
  private services = new Map<string, ServiceDependencies>()
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceDependencies): void {
    this.services.set(service.serviceId, service)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: service.serviceId })
  }

  plan(serviceId: string): UpdatePlan {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`Service not found: ${serviceId}`)

    const recommendations: UpdateRecommendation[] = []

    for (const pkg of service.packages) {
      if (pkg.currentVersion === pkg.latestVersion) continue

      let action: UpdateAction
      let priority: UpdateRecommendation['priority']
      let reason: string

      if (!pkg.licenseCompatible) {
        action = 'BLOCK'
        priority = 'CRITICAL'
        reason = '라이선스 비호환 — 법무 검토 필요'
      } else if (pkg.breakingChange) {
        action = 'MANUAL_REVIEW'
        priority = 'HIGH'
        reason = 'Breaking change 포함 — 수동 검토 필요'
      } else if (pkg.hasSecurityPatch) {
        action = 'AUTO_UPDATE'
        priority = 'CRITICAL'
        reason = '보안 패치 포함 — 즉시 자동 업데이트'
      } else {
        action = 'AUTO_UPDATE'
        priority = 'LOW'
        reason = '일반 업데이트'
      }

      recommendations.push({
        packageId: pkg.packageId,
        name: pkg.name,
        currentVersion: pkg.currentVersion,
        targetVersion: pkg.latestVersion,
        action,
        reason,
        priority,
      })
    }

    const autoUpdateCount = recommendations.filter((r) => r.action === 'AUTO_UPDATE').length
    const manualReviewCount = recommendations.filter((r) => r.action === 'MANUAL_REVIEW').length
    const blockedCount = recommendations.filter((r) => r.action === 'BLOCK').length

    this.auditLog.push({ action: 'dependency.plan', timestamp: new Date().toISOString(), detail: serviceId })
    return { serviceId, recommendations, autoUpdateCount, manualReviewCount, blockedCount }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
