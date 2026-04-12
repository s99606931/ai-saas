import { describe, it, expect, beforeEach } from 'vitest'
import { OrgOnboardingAi } from '../org-onboarding-ai'

describe('OrgOnboardingAi', () => {
  let ai: OrgOnboardingAi

  beforeEach(() => {
    ai = new OrgOnboardingAi()
  })

  it('central 조직은 15개 스텝 생성 (공통 10 + central 5)', () => {
    ai.registerOrg({ orgId: 'ORG-1', name: '행안부', type: 'central', size: 1000 })
    const steps = ai.listSteps('ORG-1')
    expect(steps.length).toBe(15)
  })

  it('local 조직은 13개 스텝 생성 (공통 10 + local 3)', () => {
    ai.registerOrg({ orgId: 'ORG-2', name: '서울시', type: 'local', size: 500 })
    expect(ai.listSteps('ORG-2').length).toBe(13)
  })

  it('public-institution 조직은 10개 스텝 (공통만)', () => {
    ai.registerOrg({ orgId: 'ORG-3', name: '공사', type: 'public-institution', size: 200 })
    expect(ai.listSteps('ORG-3').length).toBe(10)
  })

  it('스텝 완료 처리 후 진행률 상승', () => {
    ai.registerOrg({ orgId: 'ORG-4', name: '기관', type: 'public-institution', size: 100 })
    const steps = ai.listSteps('ORG-4')
    ai.completeStep('ORG-4', steps[0]!.stepId)
    const progress = ai.getProgress('ORG-4')
    expect(progress.doneSteps).toBe(1)
    expect(progress.completionRate).toBeCloseTo(0.1)
  })

  it('다음 스텝은 완료되지 않은 스텝 중 order 최소값', () => {
    ai.registerOrg({ orgId: 'ORG-5', name: '기관', type: 'public-institution', size: 100 })
    const steps = ai.listSteps('ORG-5')
    ai.completeStep('ORG-5', steps[0]!.stepId)
    const progress = ai.getProgress('ORG-5')
    expect(progress.nextStep!.order).toBe(2)
  })

  it('모든 스텝 완료 시 completionRate=1, nextStep=null', () => {
    ai.registerOrg({ orgId: 'ORG-6', name: '기관', type: 'public-institution', size: 50 })
    for (const step of ai.listSteps('ORG-6')) {
      ai.completeStep('ORG-6', step.stepId)
    }
    const progress = ai.getProgress('ORG-6')
    expect(progress.completionRate).toBe(1)
    expect(progress.nextStep).toBeNull()
  })

  it('알 수 없는 스텝 완료 시 오류', () => {
    ai.registerOrg({ orgId: 'ORG-7', name: '기관', type: 'local', size: 100 })
    expect(() => ai.completeStep('ORG-7', 'INVALID-STEP')).toThrow('Unknown step')
  })

  it('감사 로그 복사본 반환', () => {
    ai.registerOrg({ orgId: 'ORG-8', name: '기관', type: 'central', size: 300 })
    const log = ai.getAuditLog()
    log.push({ timestamp: '', action: 'injected', orgId: 'X', detail: {} })
    expect(ai.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
