import { describe, it, expect, beforeEach } from 'vitest'
import { PredictiveBudgetPlannerV3 } from '../predictive-budget-planner-v3'

describe('PredictiveBudgetPlannerV3', () => {
  let planner: PredictiveBudgetPlannerV3

  beforeEach(() => {
    planner = new PredictiveBudgetPlannerV3()
  })

  it('N2SF S등급 예산 차단', () => {
    expect(() => planner.registerBudget('b1', 1000000, 'S')).toThrow('BLOCKED')
  })

  it('잔여 1개월 이하 → CRITICAL', () => {
    planner.registerBudget('b2', 1_000_000, 'O')
    planner.recordExpense('b2', '2026-01-01T00:00:00Z', 300_000)
    planner.recordExpense('b2', '2026-02-01T00:00:00Z', 300_000)
    planner.recordExpense('b2', '2026-03-01T00:00:00Z', 300_000)
    const f = planner.forecast('b2')
    expect(f.warnLevel).toBe('CRITICAL')
  })

  it('지출 없음 → 잔여 Infinity, OK 등급', () => {
    planner.registerBudget('b3', 1_000_000, 'O')
    const f = planner.forecast('b3')
    expect(f.monthsRemaining).toBe(Infinity)
    expect(f.warnLevel).toBe('OK')
  })

  it('잔여 약 2개월 → WARN', () => {
    planner.registerBudget('b4', 1_000_000, 'O')
    // 4개월 동안 총 400k 지출 → 월평균 100k → 잔여 600k → 6개월? -> 위해 잔여 ~2개월 위해 100k/600k 패턴 사용
    planner.recordExpense('b4', '2026-01-15T00:00:00Z', 200_000)
    planner.recordExpense('b4', '2026-02-15T00:00:00Z', 200_000)
    planner.recordExpense('b4', '2026-03-15T00:00:00Z', 200_000)
    planner.recordExpense('b4', '2026-04-15T00:00:00Z', 200_000)
    // 4개월 × 200k = 800k 지출, 잔여 200k, 월평균 200k → 1개월 → CRITICAL
    // WARN을 위해 별도 케이스: 3개월 동안 100k씩 지출, 잔여 200k → 2개월
    planner.registerBudget('b4w', 500_000, 'O')
    planner.recordExpense('b4w', '2026-01-15T00:00:00Z', 100_000)
    planner.recordExpense('b4w', '2026-02-15T00:00:00Z', 100_000)
    planner.recordExpense('b4w', '2026-03-15T00:00:00Z', 100_000)
    const f = planner.forecast('b4w')
    expect(f.monthsRemaining).toBeCloseTo(2, 5)
    expect(f.warnLevel).toBe('WARN')
  })

  it('총액 0 또는 음수 거부', () => {
    expect(() => planner.registerBudget('b5', 0, 'O')).toThrow('positive')
  })

  it('감사 로그 복사본 반환', () => {
    planner.registerBudget('b6', 1_000_000, 'O')
    const log = planner.getAuditLog()
    log.push({ timestamp: '', action: 'injected', budgetId: 'X', detail: {} })
    expect(planner.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
