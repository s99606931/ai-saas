import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetExecutionAnalyzerAi, type BudgetPlan } from '../budget-execution-analyzer-ai'

describe('BudgetExecutionAnalyzerAi', () => {
  let analyzer: BudgetExecutionAnalyzerAi

  const budget: BudgetPlan = {
    budgetId: 'BDG001',
    orgId: 'ORG001',
    orgName: '행정안전부',
    fiscalYear: 2026,
    totalBudget: 100_000_000,
    categories: [
      { categoryId: 'CAT1', name: 'IT인프라', allocated: 60_000_000 },
      { categoryId: 'CAT2', name: '인건비', allocated: 40_000_000 },
    ],
  }

  beforeEach(() => {
    analyzer = new BudgetExecutionAnalyzerAi()
    analyzer.registerBudget(budget)
  })

  it('예산 등록 감사 로그', () => {
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'budget.register')).toBe(true)
  })

  it('정상 집행 (90%+) → ON_TRACK', () => {
    analyzer.recordExecution({ budgetId: 'BDG001', month: '2026-03', categoryId: 'CAT1', spent: 56_000_000 })
    analyzer.recordExecution({ budgetId: 'BDG001', month: '2026-03', categoryId: 'CAT2', spent: 38_000_000 })
    const report = analyzer.analyze('BDG001')
    expect(report.overallStatus).toBe('ON_TRACK')
  })

  it('예산 초과 → OVERSPENT + 권고사항', () => {
    analyzer.recordExecution({ budgetId: 'BDG001', month: '2026-03', categoryId: 'CAT1', spent: 70_000_000 })
    const report = analyzer.analyze('BDG001')
    const catReport = report.categoryReports.find((r) => r.categoryId === 'CAT1')!
    expect(catReport.status).toBe('OVERSPENT')
    expect(report.recommendations.some((r) => r.includes('초과'))).toBe(true)
  })

  it('집행 저조 (50% 미만) → UNDERSPENT', () => {
    analyzer.recordExecution({ budgetId: 'BDG001', month: '2026-03', categoryId: 'CAT1', spent: 10_000_000 })
    const report = analyzer.analyze('BDG001')
    const catReport = report.categoryReports.find((r) => r.categoryId === 'CAT1')!
    expect(catReport.status).toBe('UNDERSPENT')
  })

  it('집행률 계산 정확성', () => {
    analyzer.recordExecution({ budgetId: 'BDG001', month: '2026-03', categoryId: 'CAT1', spent: 30_000_000 })
    const report = analyzer.analyze('BDG001')
    const catReport = report.categoryReports.find((r) => r.categoryId === 'CAT1')!
    expect(catReport.executionRate).toBe(0.5)
  })

  it('미등록 예산 에러', () => {
    expect(() => analyzer.analyze('UNKNOWN')).toThrow()
  })

  it('분석 후 감사 로그', () => {
    analyzer.analyze('BDG001')
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'budget.analyze')).toBe(true)
  })
})
