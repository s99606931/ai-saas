// Plan SC: SVC-AI-ADV-R636
import { describe, it, expect, beforeEach } from 'vitest'
import { UrbanRegenerationAI } from '../urban-regeneration-ai'

describe('UrbanRegenerationAI', () => {
  let ai: UrbanRegenerationAI

  beforeEach(() => {
    ai = new UrbanRegenerationAI()
  })

  it('registerDistrict — 감사 로그 기록', () => {
    ai.registerDistrict({
      districtId: 'd1',
      populationDecline: 40,
      industryDecline: 30,
      oldBuildingRatio: 20,
      vacancyRate: 10,
    })
    expect(ai.getAuditLog()[0]!.action).toBe('district.register')
  })

  it('computePriority — 심각 쇠퇴는 high 우선순위', () => {
    ai.registerDistrict({
      districtId: 'd1',
      populationDecline: 80,
      industryDecline: 80,
      oldBuildingRatio: 70,
      vacancyRate: 40,
    })
    const p = ai.computePriority('d1')
    expect(p.priority).toBe('high')
  })

  it('computePriority — 건강한 지역은 low', () => {
    ai.registerDistrict({
      districtId: 'd2',
      populationDecline: 10,
      industryDecline: 10,
      oldBuildingRatio: 15,
      vacancyRate: 5,
    })
    const p = ai.computePriority('d2')
    expect(p.priority).toBe('low')
  })

  it('computePriority — 인구감소 시 청년유입 전략 추천', () => {
    ai.registerDistrict({
      districtId: 'd3',
      populationDecline: 60,
      industryDecline: 20,
      oldBuildingRatio: 20,
      vacancyRate: 10,
    })
    const p = ai.computePriority('d3')
    expect(p.recommendedStrategy).toContain('청년유입 프로그램')
  })

  it('rankDistricts — declineIndex 내림차순 정렬', () => {
    ai.registerDistrict({
      districtId: 'd1',
      populationDecline: 30,
      industryDecline: 30,
      oldBuildingRatio: 30,
      vacancyRate: 30,
    })
    ai.registerDistrict({
      districtId: 'd2',
      populationDecline: 80,
      industryDecline: 80,
      oldBuildingRatio: 80,
      vacancyRate: 80,
    })
    const ranks = ai.rankDistricts()
    expect(ranks[0]!.districtId).toBe('d2')
  })

  it('registerDistrict — S등급 차단', () => {
    expect(() =>
      ai.registerDistrict(
        {
          districtId: 'd1',
          populationDecline: 0,
          industryDecline: 0,
          oldBuildingRatio: 0,
          vacancyRate: 0,
        },
        'S',
      ),
    ).toThrow('BLOCKED')
  })
})
