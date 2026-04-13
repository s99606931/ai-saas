// Design Ref: §R425 — Tax Compliance Checker AI
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceResilienceTesterAi } from '../service-resilience-tester-ai'

describe('ServiceResilienceTesterAi (Tax Compliance Checker)', () => {
  let checker: ServiceResilienceTesterAi

  beforeEach(() => {
    checker = new ServiceResilienceTesterAi()
  })

  it('COMPLIANT: 이슈 없는 정상 신고', () => {
    const result = checker.check({ filingId: 'F001', taxpayerId: 'TAX0001234', income: 5000000, deduction: 1000000, declaredTax: 500000, calculatedTax: 500000 })
    expect(result.compliant).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('OVER_DEDUCTION: 공제액 > 소득 50% → HIGH 이슈', () => {
    const result = checker.check({ filingId: 'F002', taxpayerId: 'TAX0005678', income: 4000000, deduction: 2500000, declaredTax: 200000, calculatedTax: 200000 })
    expect(result.issues.some((i) => i.code === 'OVER_DEDUCTION' && i.severity === 'HIGH')).toBe(true)
    expect(result.compliant).toBe(false)
  })

  it('CALC_MISMATCH: |선언-계산| > 100 → MEDIUM 이슈', () => {
    const result = checker.check({ filingId: 'F003', taxpayerId: 'TAX0009012', income: 3000000, deduction: 500000, declaredTax: 300000, calculatedTax: 100000 })
    expect(result.issues.some((i) => i.code === 'CALC_MISMATCH' && i.severity === 'MEDIUM')).toBe(true)
  })

  it('CALC_MISMATCH만 있을 때 compliant=true (MEDIUM은 비준수 아님)', () => {
    const result = checker.check({ filingId: 'F004', taxpayerId: 'TAX0003456', income: 5000000, deduction: 1000000, declaredTax: 500000, calculatedTax: 300000 })
    expect(result.issues.some((i) => i.severity === 'MEDIUM')).toBe(true)
    expect(result.compliant).toBe(true)
  })

  it('PII: 감사 로그에 taxpayerId 마스킹', () => {
    checker.check({ filingId: 'F005', taxpayerId: 'TAX0007890', income: 3000000, deduction: 500000, declaredTax: 300000, calculatedTax: 300000 })
    const logs = checker.getAuditLog()
    const checkLog = logs.find((l) => l.action === 'tax.check')
    expect(checkLog?.detail).not.toContain('TAX0007890')
    expect(checkLog?.detail).toContain('*')
  })

  it('복수 이슈 복합 케이스', () => {
    const result = checker.check({ filingId: 'F006', taxpayerId: 'TAX0001111', income: 2000000, deduction: 1500000, declaredTax: 500000, calculatedTax: 200000 })
    expect(result.issues.length).toBeGreaterThanOrEqual(2)
    expect(result.compliant).toBe(false)
  })

  it('감사 로그에 tax.check 기록', () => {
    checker.check({ filingId: 'F007', taxpayerId: 'TAX0002222', income: 3000000, deduction: 500000, declaredTax: 300000, calculatedTax: 300000 })
    const logs = checker.getAuditLog()
    expect(logs.some((l) => l.action === 'tax.check')).toBe(true)
  })
})
