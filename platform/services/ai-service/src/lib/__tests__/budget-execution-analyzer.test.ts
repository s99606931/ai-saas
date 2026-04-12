import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetExecutionAnalyzer, type BudgetItem, type ExecutionRecord } from '../budget-execution-analyzer'

describe('BudgetExecutionAnalyzer', () => {
  let analyzer: BudgetExecutionAnalyzer

  const item: BudgetItem = {
    itemId: 'i1',
    department: 'IT부서',
    name: '운영비',
    annualBudget: 12_000_000,
    fiscalYear: 2026,
  }

  const makeRecord = (month: number, amount: number): ExecutionRecord => ({
    itemId: 'i1',
    month,
    amount,
    category: 'OPERATIONS',
    description: '운영비 집행',
  })

  beforeEach(() => {
    analyzer = new BudgetExecutionAnalyzer()
    analyzer.registerItem(item)
  })

  it('예산 항목 등록 감사 로그', () => {
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'item.register')).toBe(true)
  })

  it('집행 기록', () => {
    analyzer.recordExecution(makeRecord(1, 1_000_000))
    const analysis = analyzer.analyze('i1')
    expect(analysis.totalSpent).toBe(1_000_000)
  })

  it('월 범위 오류 (0월)', () => {
    expect(() => analyzer.recordExecution(makeRecord(0, 100))).toThrow()
  })

  it('월 범위 오류 (13월)', () => {
    expect(() => analyzer.recordExecution(makeRecord(13, 100))).toThrow()
  })

  it('미등록 항목 에러', () => {
    expect(() =>
      analyzer.recordExecution({ ...makeRecord(1, 100), itemId: 'unknown' })
    ).toThrow()
  })

  it('집행률 계산', () => {
    analyzer.recordExecution(makeRecord(1, 6_000_000)) // 50%
    const analysis = analyzer.analyze('i1')
    expect(analysis.executionRate).toBeCloseTo(0.5, 2)
  })

  it('상반기 집중 집행 → FRONT_LOADED', () => {
    for (let m = 1; m <= 6; m++) {
      analyzer.recordExecution(makeRecord(m, 1_800_000)) // 10.8M in H1
    }
    analyzer.recordExecution(makeRecord(7, 100_000))
    const analysis = analyzer.analyze('i1')
    expect(analysis.pattern).toBe('FRONT_LOADED')
  })

  it('하반기 집중 집행 → BACK_LOADED', () => {
    analyzer.recordExecution(makeRecord(1, 100_000))
    for (let m = 7; m <= 12; m++) {
      analyzer.recordExecution(makeRecord(m, 2_000_000))
    }
    const analysis = analyzer.analyze('i1')
    expect(analysis.pattern).toBe('BACK_LOADED')
  })

  it('집행률 50% 미만 권고 메시지', () => {
    analyzer.recordExecution(makeRecord(1, 100_000)) // 아주 낮은 집행
    const analysis = analyzer.analyze('i1')
    expect(analysis.recommendation).toContain('50%')
  })

  it('감사 로그 분석 기록', () => {
    analyzer.analyze('i1')
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'analysis.complete')).toBe(true)
  })
})
