import { describe, it, expect, beforeEach } from 'vitest'
import { SaasOnboardingOptimizerAi, type TenantOnboarding } from '../saas-onboarding-optimizer-ai'

describe('SaasOnboardingOptimizerAi', () => {
  let ai: SaasOnboardingOptimizerAi

  const tenant: TenantOnboarding = {
    tenantId: 'TENANT001',
    orgName: '행정안전부',
    targetGoLiveDate: '2026-06-01',
    assignedSupportLevel: 'STANDARD',
  }

  beforeEach(() => {
    ai = new SaasOnboardingOptimizerAi()
    ai.registerTenant(tenant)
  })

  it('테넌트 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'tenant.register')).toBe(true)
  })

  it('진행 없으면 SIGNUP 단계, progress 0%', () => {
    const result = ai.analyze('TENANT001')
    expect(result.currentStage).toBe('SIGNUP')
    expect(result.overallProgress).toBe(0)
  })

  it('SIGNUP 완료 → PROFILE_SETUP 단계', () => {
    ai.recordProgress({ tenantId: 'TENANT001', stage: 'SIGNUP', status: 'COMPLETED', daysSpent: 1 })
    const result = ai.analyze('TENANT001')
    expect(result.currentStage).toBe('PROFILE_SETUP')
    expect(result.overallProgress).toBe(20)
  })

  it('STUCK 단계 → HIGH 위험 + 권고사항', () => {
    ai.recordProgress({ tenantId: 'TENANT001', stage: 'SIGNUP', status: 'COMPLETED', daysSpent: 1 })
    ai.recordProgress({ tenantId: 'TENANT001', stage: 'INTEGRATION', status: 'STUCK', daysSpent: 30 })
    ai.recordProgress({ tenantId: 'TENANT001', stage: 'TRAINING', status: 'STUCK', daysSpent: 10 })
    const result = ai.analyze('TENANT001')
    expect(result.riskLevel).toBe('HIGH')
    expect(result.blockedStages).toContain('INTEGRATION')
  })

  it('지연 단계 → 권고사항 생성', () => {
    // INTEGRATION 예상 10일, 실제 30일 → 2배 초과
    ai.recordProgress({ tenantId: 'TENANT001', stage: 'INTEGRATION', status: 'IN_PROGRESS', daysSpent: 30 })
    const result = ai.analyze('TENANT001')
    expect(result.recommendations.some((r) => r.includes('INTEGRATION'))).toBe(true)
  })

  it('미등록 테넌트 에러', () => {
    expect(() => ai.analyze('UNKNOWN')).toThrow()
  })

  it('미등록 테넌트 진행 기록 에러', () => {
    expect(() => ai.recordProgress({ tenantId: 'UNKNOWN', stage: 'SIGNUP', status: 'COMPLETED', daysSpent: 1 })).toThrow()
  })

  it('분석 후 감사 로그', () => {
    ai.analyze('TENANT001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'onboarding.analyze')).toBe(true)
  })
})
