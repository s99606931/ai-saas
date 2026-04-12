/**
 * AI 기반 서비스 카탈로그 자동화 단위 테스트 — SVC-AI-ADV-R182
 * Plan SC: FR-R182.1 ~ FR-R182.5
 */

import { describe, it, expect } from 'vitest'
import { ServiceCatalogAI, DataGrade } from '../service-catalog-ai-r182'

const svcA = {
  id: 'svc-a',
  name: '문서 관리 SaaS',
  category: '문서',
  keywords: ['문서', '전자결재', '보관'],
  plans: [
    { name: 'basic', monthlyPrice: 100_000, features: ['전자결재', '보관'], maxUsers: 10 },
    { name: 'pro', monthlyPrice: 300_000, features: ['전자결재', '보관', 'OCR'], maxUsers: 100 },
  ],
}

const svcB = {
  id: 'svc-b',
  name: '보안 관제 SaaS',
  category: '보안',
  keywords: ['보안', '관제', '접근제어'],
  plans: [
    { name: 'standard', monthlyPrice: 200_000, features: ['보안감시', '로그'], maxUsers: 50 },
  ],
}

describe('ServiceCatalogAI — R182', () => {
  it('FR-R182.1: 서비스 등록 및 audit log', () => {
    const cat = new ServiceCatalogAI(DataGrade.O)
    cat.registerService(svcA)
    const log = cat.getAuditLog()
    expect(log[0]?.action).toBe('serviceRegistered')
    expect(log[0]?.details.id).toBe('svc-a')
  })

  it('FR-R182.2: 요구사항 기반 검색', () => {
    const cat = new ServiceCatalogAI(DataGrade.O)
    cat.registerService(svcA)
    cat.registerService(svcB)
    const results = cat.search(['문서', '전자결재'])
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.service.id).toBe('svc-a')
  })

  it('FR-R182.3: 매칭 점수 및 추천 플랜', () => {
    const cat = new ServiceCatalogAI(DataGrade.O)
    cat.registerService(svcA)
    const results = cat.search(['문서', '전자결재', '보관'])
    expect(results[0]?.matchScore).toBe(1)
    expect(results[0]?.recommendedPlan.name).toBe('basic') // cheapest
  })

  it('FR-R182.4: 플랜 비교 — cheapestServiceId 정확', () => {
    const cat = new ServiceCatalogAI(DataGrade.O)
    cat.registerService(svcA)
    cat.registerService(svcB)
    const comparison = cat.comparePlans(['svc-a', 'svc-b'])
    expect(comparison.cheapestServiceId).toBe('svc-a') // 100k < 200k
    expect(comparison.featureMatrix['svc-a']).toContain('전자결재')
  })

  it('FR-R182.5: audit log append-only', () => {
    const cat = new ServiceCatalogAI(DataGrade.O)
    cat.registerService(svcA)
    const log1 = cat.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(cat.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new ServiceCatalogAI(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new ServiceCatalogAI(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 id 등록 throw', () => {
    const cat = new ServiceCatalogAI(DataGrade.O)
    expect(() => cat.registerService({ ...svcA, id: '' })).toThrow('must not be empty')
  })

  it('플랜 없는 서비스 등록 throw', () => {
    const cat = new ServiceCatalogAI(DataGrade.O)
    expect(() => cat.registerService({ ...svcA, plans: [] })).toThrow('at least one plan')
  })
})
