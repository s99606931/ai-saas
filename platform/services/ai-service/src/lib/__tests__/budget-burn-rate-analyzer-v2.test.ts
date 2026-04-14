import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetBurnRateAnalyzerV2 } from '../budget-burn-rate-analyzer-v2'

describe('BudgetBurnRateAnalyzerV2', () => {
  let analyzer: BudgetBurnRateAnalyzerV2

  beforeEach(() => {
    analyzer = new BudgetBurnRateAnalyzerV2()
  })

  it('should register a budget', () => {
    analyzer.registerBudget('b1', 'IT Budget', 1000000)
    expect(analyzer.getBurnRate('b1')).toBe(0)
  })

  it('should compute burn rate as totalSpent/totalBudget*100', () => {
    analyzer.registerBudget('b1', 'IT', 1000000)
    analyzer.recordSpending('b1', 500000)
    expect(analyzer.getBurnRate('b1')).toBe(50)
  })

  it('should accumulate spending', () => {
    analyzer.registerBudget('b1', 'IT', 1000000)
    analyzer.recordSpending('b1', 300000)
    analyzer.recordSpending('b1', 400000)
    expect(analyzer.getBurnRate('b1')).toBe(70)
  })

  it('should identify over-burned budgets (burn rate > 90%)', () => {
    analyzer.registerBudget('b1', 'Critical', 100000)
    analyzer.registerBudget('b2', 'Normal', 100000)
    analyzer.recordSpending('b1', 95000) // 95%
    analyzer.recordSpending('b2', 50000) // 50%
    const over = analyzer.getOverBurnedBudgets()
    expect(over.map((b: { budgetId: string }) => b.budgetId)).toContain('b1')
    expect(over.map((b: { budgetId: string }) => b.budgetId)).not.toContain('b2')
  })

  it('should block C grade data', () => {
    analyzer.registerBudget('b1', 'X', 100000)
    expect(() => analyzer.recordSpending('b1', 10000, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    analyzer.registerBudget('b1', 'X', 100000)
    expect(() => analyzer.recordSpending('b1', 10000, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    analyzer.registerBudget('b1', 'IT', 100000)
    analyzer.recordSpending('b1', 10000)
    expect(analyzer.getAuditLog().length).toBeGreaterThan(0)
  })
})
