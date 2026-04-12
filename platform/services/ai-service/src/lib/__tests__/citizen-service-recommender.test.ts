import { describe, it, expect, beforeEach } from 'vitest'
import {
  CitizenServiceRecommender,
  type ServiceCatalogItem,
  type CitizenProfile,
} from '../citizen-service-recommender'

describe('CitizenServiceRecommender', () => {
  let recommender: CitizenServiceRecommender

  const youthSupport: ServiceCatalogItem = {
    serviceId: 'SVC-YOUTH-01',
    name: '청년 월세 지원',
    category: '주거',
    description: '만 19~34세 청년 대상 월세 지원',
    minAge: 19,
    maxAge: 34,
    maxIncome: 3000000,
    urgencyScore: 80,
  }

  const seniorHealthCheck: ServiceCatalogItem = {
    serviceId: 'SVC-SENIOR-01',
    name: '어르신 건강검진',
    category: '의료',
    description: '65세 이상 무료 건강검진',
    minAge: 65,
    regions: ['서울'],
    urgencyScore: 60,
  }

  const citizen: CitizenProfile = {
    citizenId: 'CITIZEN-A1B2C3',
    age: 28,
    monthlyIncome: 2500000,
    householdSize: 1,
    region: '서울',
    preferences: ['주거', '교육'],
    grade: 'O',
  }

  beforeEach(() => {
    recommender = new CitizenServiceRecommender()
    recommender.registerService(youthSupport)
    recommender.registerService(seniorHealthCheck)
    recommender.registerCitizen(citizen)
  })

  it('C등급 시민 차단', () => {
    expect(() =>
      recommender.registerCitizen({ ...citizen, citizenId: 'CITIZEN-X', grade: 'C' })
    ).toThrow('BLOCKED')
  })

  it('O등급 아닌 경우 거부', () => {
    expect(() =>
      recommender.registerCitizen({ ...citizen, citizenId: 'CITIZEN-Y', grade: undefined })
    ).toThrow('O등급만')
  })

  it('자격 충족 → ELIGIBLE', () => {
    const elig = recommender.checkEligibility('CITIZEN-A1B2C3', 'SVC-YOUTH-01')
    expect(elig.status).toBe('ELIGIBLE')
    expect(elig.failedCriteria).toHaveLength(0)
  })

  it('연령 불일치 → NOT_ELIGIBLE', () => {
    const elig = recommender.checkEligibility('CITIZEN-A1B2C3', 'SVC-SENIOR-01')
    expect(elig.status).toBe('PARTIAL')  // 지역은 매칭, 연령 실패
    expect(elig.failedCriteria.some((c) => c.includes('최소 연령'))).toBe(true)
  })

  it('우선순위 점수 — 선호 카테고리 + 자격 충족 시 높음', () => {
    const score = recommender.calculatePriority('CITIZEN-A1B2C3', 'SVC-YOUTH-01')
    expect(score).toBeGreaterThanOrEqual(80)  // 60 eligible + 16 urgency + 20 pref
  })

  it('추천 반환 — 자격 있는 서비스만', () => {
    const recs = recommender.recommend('CITIZEN-A1B2C3', 5)
    expect(recs.length).toBeGreaterThanOrEqual(1)
    expect(recs[0]?.serviceId).toBe('SVC-YOUTH-01')
  })

  it('미등록 시민 → 에러', () => {
    expect(() => recommender.recommend('UNKNOWN', 5)).toThrow('Unknown citizen')
  })

  it('나이 유효성 검증', () => {
    expect(() =>
      recommender.registerCitizen({ ...citizen, citizenId: 'C2', age: -1 })
    ).toThrow('age')
  })

  it('감사 로그 — citizenId 마스킹 확인', () => {
    recommender.recommend('CITIZEN-A1B2C3', 5)
    const log = recommender.getAuditLog()
    const hasMasked = log.some((e) => e.citizenIdMasked.includes('***'))
    expect(hasMasked).toBe(true)
    // 원본 ID 노출 금지
    const hasRaw = log.some((e) => e.citizenIdMasked === 'CITIZEN-A1B2C3')
    expect(hasRaw).toBe(false)
  })

  it('추천 결과 우선순위 내림차순 정렬', () => {
    const recs = recommender.recommend('CITIZEN-A1B2C3', 5)
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1]!.priorityScore).toBeGreaterThanOrEqual(recs[i]!.priorityScore)
    }
  })
})
