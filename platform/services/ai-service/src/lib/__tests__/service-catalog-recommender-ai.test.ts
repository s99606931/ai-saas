import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceCatalogRecommenderAi, type CatalogService, type TenantProfile } from '../service-catalog-recommender-ai'

describe('ServiceCatalogRecommenderAi', () => {
  let ai: ServiceCatalogRecommenderAi

  const service: CatalogService = {
    serviceId: 'SVC001',
    name: '전자결재 서비스',
    category: 'WORKFLOW',
    tags: ['approval', 'document'],
    usageCount: 150,
    avgRating: 4.7,
    targetOrgTypes: ['GOVERNMENT', 'ALL'],
  }

  const tenant: TenantProfile = {
    tenantId: 'TENANT001',
    orgType: 'GOVERNMENT',
    usedServiceIds: [],
    preferredCategories: ['WORKFLOW'],
  }

  beforeEach(() => {
    ai = new ServiceCatalogRecommenderAi()
    ai.registerService(service)
    ai.registerTenant(tenant)
  })

  it('서비스 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('조직 유형 + 카테고리 + 인기도 + 평점 → 높은 점수 추천', () => {
    const result = ai.recommend('TENANT001')
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.recommendations[0]?.serviceId).toBe('SVC001')
    expect(result.recommendations[0]?.score).toBeGreaterThan(50)
  })

  it('이미 사용 중인 서비스는 추천에서 제외', () => {
    ai.registerTenant({ ...tenant, tenantId: 'TENANT002', usedServiceIds: ['SVC001'] })
    const result = ai.recommend('TENANT002')
    expect(result.recommendations.every((r) => r.serviceId !== 'SVC001')).toBe(true)
  })

  it('낮은 평점 서비스 → 낮은 추천 점수', () => {
    ai.registerService({ ...service, serviceId: 'SVC002', avgRating: 2.0, usageCount: 5 })
    const result = ai.recommend('TENANT001')
    const lowRated = result.recommendations.find((r) => r.serviceId === 'SVC002')
    const highRated = result.recommendations.find((r) => r.serviceId === 'SVC001')
    if (lowRated && highRated) {
      expect(highRated.score).toBeGreaterThan(lowRated.score)
    }
  })

  it('topN 파라미터 적용', () => {
    for (let i = 2; i <= 10; i++) {
      ai.registerService({ ...service, serviceId: `SVC${i.toString().padStart(3, '0')}`, name: `서비스${i}` })
    }
    const result = ai.recommend('TENANT001', 3)
    expect(result.recommendations.length).toBeLessThanOrEqual(3)
  })

  it('미등록 테넌트 에러', () => {
    expect(() => ai.recommend('UNKNOWN')).toThrow()
  })

  it('추천 후 감사 로그', () => {
    ai.recommend('TENANT001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'catalog.recommend')).toBe(true)
  })
})
