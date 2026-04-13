// Design Ref: §R421 — AI-Powered Grant Reviewer
import { describe, it, expect, beforeEach } from 'vitest'
import { ApiRateLimiterOptimizerAi } from '../api-rate-limiter-optimizer-ai'

describe('ApiRateLimiterOptimizerAi (Grant Reviewer)', () => {
  let reviewer: ApiRateLimiterOptimizerAi

  beforeEach(() => {
    reviewer = new ApiRateLimiterOptimizerAi()
    reviewer.setRule({ incomeCap: 5000000, minAge: 18, baseAmount: 1000000 })
  })

  it('N2SF: C등급 신청 차단', () => {
    expect(() => reviewer.review({ applicantId: 'APP001234', income: 1000000, age: 30, familySize: 3, fraudHistory: false, dataGrade: 'C' }))
      .toThrow('BLOCKED')
  })

  it('N2SF: S등급 신청 차단', () => {
    expect(() => reviewer.review({ applicantId: 'APP001234', income: 1000000, age: 30, familySize: 3, fraudHistory: false, dataGrade: 'S' }))
      .toThrow('BLOCKED')
  })

  it('INCOME_OVER: 소득 초과 시 비적격', () => {
    const result = reviewer.review({ applicantId: 'APP001234', income: 6000000, age: 30, familySize: 3, fraudHistory: false, dataGrade: 'O' })
    expect(result.eligible).toBe(false)
    expect(result.reasonCode).toBe('INCOME_OVER')
    expect(result.recommendedAmount).toBe(0)
  })

  it('AGE_UNDER: 나이 미달 시 비적격', () => {
    const result = reviewer.review({ applicantId: 'APP005678', income: 1000000, age: 16, familySize: 2, fraudHistory: false, dataGrade: 'O' })
    expect(result.eligible).toBe(false)
    expect(result.reasonCode).toBe('AGE_UNDER')
  })

  it('APPROVED: 적격 시 권고금액 산출', () => {
    const result = reviewer.review({ applicantId: 'APP009012', income: 2500000, age: 30, familySize: 4, fraudHistory: false, dataGrade: 'O' })
    expect(result.eligible).toBe(true)
    expect(result.recommendedAmount).toBeGreaterThan(0)
  })

  it('fraudHistory=true → riskLevel HIGH (적격이어도)', () => {
    const result = reviewer.review({ applicantId: 'APP003456', income: 1000000, age: 25, familySize: 2, fraudHistory: true, dataGrade: 'O' })
    expect(result.riskLevel).toBe('HIGH')
  })

  it('감사 로그에 grant.review 기록 (PII 마스킹)', () => {
    reviewer.review({ applicantId: 'APP007890', income: 1000000, age: 30, familySize: 3, fraudHistory: false, dataGrade: 'O' })
    const logs = reviewer.getAuditLog()
    const reviewLog = logs.find((l) => l.action === 'grant.review')
    expect(reviewLog).toBeDefined()
    expect(reviewLog?.detail).not.toContain('APP007890')
  })
})
