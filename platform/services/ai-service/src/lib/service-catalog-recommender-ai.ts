// Design Ref: §R299 — AI기반 서비스 카탈로그 추천
// Plan SC: SC-R299

export interface CatalogService {
  serviceId: string
  name: string
  category: string
  tags: string[]
  usageCount: number
  avgRating: number
  targetOrgTypes: string[]
}

export interface TenantProfile {
  tenantId: string
  orgType: string
  usedServiceIds: string[]
  preferredCategories: string[]
}

export interface ServiceRecommendation {
  serviceId: string
  name: string
  score: number
  reasons: string[]
}

export interface RecommendationResult {
  tenantId: string
  recommendations: ServiceRecommendation[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceCatalogRecommenderAi {
  private catalog = new Map<string, CatalogService>()
  private tenants = new Map<string, TenantProfile>()
  private auditLog: AuditEntry[] = []

  registerService(service: CatalogService): void {
    this.catalog.set(service.serviceId, service)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: service.serviceId })
  }

  registerTenant(tenant: TenantProfile): void {
    this.tenants.set(tenant.tenantId, tenant)
    this.auditLog.push({ action: 'tenant.register', timestamp: new Date().toISOString(), detail: tenant.tenantId })
  }

  recommend(tenantId: string, topN = 5): RecommendationResult {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`)

    const recommendations: ServiceRecommendation[] = []

    for (const service of this.catalog.values()) {
      if (tenant.usedServiceIds.includes(service.serviceId)) continue

      let score = 0
      const reasons: string[] = []

      // 조직 유형 일치
      if (service.targetOrgTypes.includes(tenant.orgType) || service.targetOrgTypes.includes('ALL')) {
        score += 30
        reasons.push('조직 유형 적합')
      }

      // 선호 카테고리 일치
      if (tenant.preferredCategories.includes(service.category)) {
        score += 25
        reasons.push(`선호 카테고리(${service.category}) 일치`)
      }

      // 인기도 (usageCount 상위)
      if (service.usageCount >= 100) {
        score += 20
        reasons.push('높은 사용 빈도')
      } else if (service.usageCount >= 50) {
        score += 10
      }

      // 평점
      if (service.avgRating >= 4.5) {
        score += 15
        reasons.push('높은 사용자 평점')
      } else if (service.avgRating >= 4.0) {
        score += 8
      }

      if (score > 0) {
        recommendations.push({ serviceId: service.serviceId, name: service.name, score, reasons })
      }
    }

    recommendations.sort((a, b) => b.score - a.score)
    const topRecommendations = recommendations.slice(0, topN)

    this.auditLog.push({ action: 'catalog.recommend', timestamp: new Date().toISOString(), detail: tenantId })
    return { tenantId, recommendations: topRecommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
