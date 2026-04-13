import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMaturityAssessorAi, type ServiceProfile } from '../service-maturity-assessor-ai'

describe('ServiceMaturityAssessorAi', () => {
  let ai: ServiceMaturityAssessorAi

  const excellentService: ServiceProfile = {
    serviceId: 'SVC001',
    name: '민원 API',
    uptimePercent: 99.95,
    avgResponseMs: 80,
    deployFrequencyPerMonth: 25,
    mttrMinutes: 10,
    testCoveragePercent: 85,
    hasMonitoring: true,
    hasAlerts: true,
    hasCiCd: true,
  }

  beforeEach(() => {
    ai = new ServiceMaturityAssessorAi()
    ai.registerService(excellentService)
  })

  it('서비스 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('최고 성능 서비스 → L5_OPTIMIZING', () => {
    const result = ai.assess('SVC001')
    expect(result.maturityLevel).toBe('L5_OPTIMIZING')
    expect(result.maturityScore).toBeGreaterThanOrEqual(90)
  })

  it('모니터링/알림/CI-CD 없음 → 개선사항 생성', () => {
    ai.registerService({
      ...excellentService,
      serviceId: 'SVC002',
      hasMonitoring: false,
      hasAlerts: false,
      hasCiCd: false,
    })
    const result = ai.assess('SVC002')
    expect(result.improvements.some((i) => i.includes('모니터링'))).toBe(true)
    expect(result.improvements.some((i) => i.includes('알림'))).toBe(true)
    expect(result.improvements.some((i) => i.includes('CI/CD'))).toBe(true)
  })

  it('낮은 가용성 → L1_INITIAL', () => {
    ai.registerService({
      ...excellentService,
      serviceId: 'SVC003',
      uptimePercent: 90,
      avgResponseMs: 2000,
      deployFrequencyPerMonth: 0,
      mttrMinutes: 480,
      hasMonitoring: false,
      hasAlerts: false,
      hasCiCd: false,
      testCoveragePercent: 10,
    })
    const result = ai.assess('SVC003')
    expect(result.maturityLevel).toBe('L1_INITIAL')
    expect(result.improvements.length).toBeGreaterThan(0)
  })

  it('높은 테스트 커버리지 → strengths 포함', () => {
    const result = ai.assess('SVC001')
    expect(result.strengths.some((s) => s.includes('테스트 커버리지'))).toBe(true)
  })

  it('미등록 서비스 에러', () => {
    expect(() => ai.assess('UNKNOWN')).toThrow()
  })

  it('평가 후 감사 로그', () => {
    ai.assess('SVC001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'maturity.assess')).toBe(true)
  })
})
