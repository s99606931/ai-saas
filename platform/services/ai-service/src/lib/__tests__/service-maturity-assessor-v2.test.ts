import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMaturityAssessorV2 } from '../service-maturity-assessor-v2'

describe('ServiceMaturityAssessorV2', () => {
  let assessor: ServiceMaturityAssessorV2

  beforeEach(() => {
    assessor = new ServiceMaturityAssessorV2()
  })

  it('서비스 등록 후 조회 가능', () => {
    const svc = assessor.registerService('svc-1', '민원서비스', 'public')
    expect(svc.serviceId).toBe('svc-1')
    expect(svc.name).toBe('민원서비스')
  })

  it('차원 점수 기록 후 성숙도 점수 평균 계산', () => {
    assessor.registerService('svc-1', '민원서비스', 'public')
    assessor.recordDimensionScore('svc-1', 'process', 80)
    assessor.recordDimensionScore('svc-1', 'technology', 60)
    const score = assessor.getMaturityScore('svc-1')
    expect(score).toBe(70)
  })

  it('점수 없으면 성숙도 점수 0', () => {
    assessor.registerService('svc-1', '민원서비스', 'public')
    expect(assessor.getMaturityScore('svc-1')).toBe(0)
  })

  it('platinum 등급: 점수 80 이상', () => {
    assessor.registerService('svc-1', '민원서비스', 'public')
    assessor.recordDimensionScore('svc-1', 'process', 90)
    expect(assessor.getMaturityGrade('svc-1')).toBe('platinum')
  })

  it('gold 등급: 점수 60 이상 80 미만', () => {
    assessor.registerService('svc-1', '민원서비스', 'public')
    assessor.recordDimensionScore('svc-1', 'process', 65)
    expect(assessor.getMaturityGrade('svc-1')).toBe('gold')
  })

  it('silver 등급: 점수 40 이상 60 미만', () => {
    assessor.registerService('svc-1', '민원서비스', 'public')
    assessor.recordDimensionScore('svc-1', 'process', 50)
    expect(assessor.getMaturityGrade('svc-1')).toBe('silver')
  })

  it('bronze 등급: 점수 40 미만', () => {
    assessor.registerService('svc-1', '민원서비스', 'public')
    assessor.recordDimensionScore('svc-1', 'process', 30)
    expect(assessor.getMaturityGrade('svc-1')).toBe('bronze')
  })

  it('getLowMaturityServices: bronze/silver 서비스만 반환', () => {
    assessor.registerService('svc-1', 'A', 'public')
    assessor.registerService('svc-2', 'B', 'public')
    assessor.recordDimensionScore('svc-1', 'process', 90)
    assessor.recordDimensionScore('svc-2', 'process', 30)
    const low = assessor.getLowMaturityServices(60)
    expect(low.map((s) => s.serviceId)).toContain('svc-2')
    expect(low.map((s) => s.serviceId)).not.toContain('svc-1')
  })

  it('C등급 데이터 전송 차단', () => {
    assessor.registerService('svc-1', '민원서비스', 'public')
    expect(() => assessor.recordDimensionScore('svc-1', 'process', 80, 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    assessor.registerService('svc-1', '민원서비스', 'public')
    assessor.recordDimensionScore('svc-1', 'process', 80)
    const log = assessor.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
