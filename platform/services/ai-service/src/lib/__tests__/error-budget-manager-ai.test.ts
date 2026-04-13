import { describe, it, expect, beforeEach } from 'vitest'
import { ErrorBudgetManagerAi, type SloDefinition } from '../error-budget-manager-ai'

describe('ErrorBudgetManagerAi', () => {
  let manager: ErrorBudgetManagerAi

  const slo: SloDefinition = {
    sloId: 'SLO001',
    serviceId: 'SVC001',
    targetSuccessRate: 0.99,
    windowDays: 30,
  }

  beforeEach(() => {
    manager = new ErrorBudgetManagerAi()
    manager.registerSlo(slo)
  })

  it('SLO 등록 감사 로그', () => {
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'slo.register')).toBe(true)
  })

  it('완벽한 성공률 → HEALTHY remainingBudget 100%', () => {
    manager.recordMeasurement({ sloId: 'SLO001', timestamp: Date.now(), totalRequests: 1000, successfulRequests: 1000 })
    const report = manager.report('SLO001')
    expect(report.budgetStatus).toBe('HEALTHY')
    expect(report.remainingBudgetPercent).toBe(100)
  })

  it('에러율 = 허용 에러율 → EXHAUSTED', () => {
    // 99% SLO, 1% 허용, 1% 에러 = 소진
    manager.recordMeasurement({ sloId: 'SLO001', timestamp: Date.now(), totalRequests: 1000, successfulRequests: 990 })
    const report = manager.report('SLO001')
    expect(report.budgetStatus).toBe('EXHAUSTED')
    expect(report.remainingBudgetPercent).toBe(0)
  })

  it('에러율 허용 에러율 80% → WARNING', () => {
    // 1% 허용, 0.8% 에러 → 80% 소진 → remaining 20% ≤ 25% → WARNING
    manager.recordMeasurement({ sloId: 'SLO001', timestamp: Date.now(), totalRequests: 1000, successfulRequests: 992 })
    const report = manager.report('SLO001')
    expect(report.budgetStatus).toBe('WARNING')
  })

  it('burnRate 계산 정확성', () => {
    // 2% 에러 / 1% 허용 = burn rate 2
    manager.recordMeasurement({ sloId: 'SLO001', timestamp: Date.now(), totalRequests: 1000, successfulRequests: 980 })
    const report = manager.report('SLO001')
    expect(report.burnRate).toBeGreaterThan(1)
  })

  it('burnRate > 1 → projectedExhaustionDays 계산', () => {
    manager.recordMeasurement({ sloId: 'SLO001', timestamp: Date.now(), totalRequests: 1000, successfulRequests: 980 })
    const report = manager.report('SLO001')
    // burnRate > 1이므로 예상 소진일 존재
    expect(report.projectedExhaustionDays).not.toBeNull()
  })

  it('측정값 없으면 currentSuccessRate 1.0 → HEALTHY', () => {
    const report = manager.report('SLO001')
    expect(report.currentSuccessRate).toBe(1.0)
    expect(report.budgetStatus).toBe('HEALTHY')
  })

  it('미등록 SLO 에러', () => {
    expect(() => manager.report('UNKNOWN')).toThrow()
  })

  it('리포트 후 감사 로그', () => {
    manager.report('SLO001')
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'budget.report')).toBe(true)
  })
})
