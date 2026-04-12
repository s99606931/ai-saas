/**
 * Unit tests — Budget Optimizer AI (SVC-AI-ADV-R132 트랙B 2차)
 * Plan SC: FR-R132.1 ~ FR-R132.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetOptimizerAi } from '../budget-optimizer-ai'

describe('SVC-AI-ADV-R132 BudgetOptimizerAi', () => {
  let optimizer: BudgetOptimizerAi

  beforeEach(() => {
    optimizer = new BudgetOptimizerAi()
    optimizer.registerBudget({ itemId: 'IT-001', name: 'IT 인프라', allocated: 10000000, category: 'IT' })
    optimizer.registerBudget({ itemId: 'EDU-001', name: '교육 훈련', allocated: 5000000, category: 'HR' })
    optimizer.registerBudget({ itemId: 'OPS-001', name: '운영 비용', allocated: 3000000, category: 'OPS' })
  })

  it('[FR-R132.3] 과집행 항목 OVER 분류', () => {
    optimizer.recordExpense('IT-001', 9800000, '2026-03-31')
    const statuses = optimizer.analyzeExecution()
    const it = statuses.find((s) => s.itemId === 'IT-001')!
    expect(it.status).toBe('OVER')
    expect(it.executionRate).toBeGreaterThan(0.95)
  })

  it('[FR-R132.3] 미집행 항목 UNDER 분류', () => {
    optimizer.recordExpense('EDU-001', 500000, '2026-03-31')
    const statuses = optimizer.analyzeExecution()
    const edu = statuses.find((s) => s.itemId === 'EDU-001')!
    expect(edu.status).toBe('UNDER')
    expect(edu.executionRate).toBeLessThan(0.5)
  })

  it('[FR-R132.3] 정상 집행 항목 NORMAL 분류', () => {
    optimizer.recordExpense('OPS-001', 2000000, '2026-03-31')
    const statuses = optimizer.analyzeExecution()
    const ops = statuses.find((s) => s.itemId === 'OPS-001')!
    expect(ops.status).toBe('NORMAL')
  })

  it('[FR-R132.4] UNDER→OVER 재배분 제안 생성', () => {
    optimizer.recordExpense('IT-001', 9900000, '2026-03-31')
    optimizer.recordExpense('EDU-001', 200000, '2026-03-31')
    const suggestions = optimizer.suggestReallocation()
    expect(suggestions.length).toBeGreaterThan(0)
    // UNDER 항목(EDU-001 또는 OPS-001) → OVER 항목(IT-001)으로 제안
    const toIt = suggestions.filter((s) => s.toItemId === 'IT-001')
    expect(toIt.length).toBeGreaterThan(0)
    expect(toIt[0]!.amount).toBeGreaterThan(0)
    expect(['EDU-001', 'OPS-001']).toContain(toIt[0]!.fromItemId)
  })

  it('[FR-R132.1] 음수 예산 등록 시 에러', () => {
    expect(() =>
      optimizer.registerBudget({ itemId: 'BAD', name: 'Bad', allocated: -1, category: 'X' }),
    ).toThrow('non-negative')
  })

  it('[FR-R132.5] CSAP D-06 감사 로그 append-only', () => {
    optimizer.analyzeExecution()
    const log = optimizer.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    const copy = optimizer.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', detail: {} })
    expect(optimizer.getAuditLog().length).toBe(log.length)
  })
})
