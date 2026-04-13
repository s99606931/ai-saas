import { describe, it, expect, beforeEach } from 'vitest'
import { AiBudgetExecutionMonitor } from '../ai-budget-execution-monitor.js'

describe('AiBudgetExecutionMonitor (FR-R501.1)', () => {
  let svc: AiBudgetExecutionMonitor

  beforeEach(() => {
    svc = new AiBudgetExecutionMonitor()
  })

  it('항목 등록 후 정상 집행 평가', () => {
    svc.registerItem({ itemId: 'B1', category: '인건비', allocated: 1000, fiscalYear: 2026 }, 'O')
    svc.recordExecution({ itemId: 'B1', period: '2026-Q1', executed: 600 }, 'O')
    const r = svc.evaluate('B1')
    expect(r.executionRate).toBeCloseTo(60, 0)
    expect(r.status).toBe('NORMAL')
    expect(r.remaining).toBe(400)
  })

  it('과집행 시 OVER_EXECUTED', () => {
    svc.registerItem({ itemId: 'B2', category: '운영비', allocated: 100, fiscalYear: 2026 }, 'O')
    svc.recordExecution({ itemId: 'B2', period: '2026-01', executed: 105 }, 'O')
    const r = svc.evaluate('B2')
    expect(r.status).toBe('OVER_EXECUTED')
  })

  it('110% 초과 시 CRITICAL', () => {
    svc.registerItem({ itemId: 'B3', category: '사업비', allocated: 100, fiscalYear: 2026 }, 'O')
    svc.recordExecution({ itemId: 'B3', period: '2026-01', executed: 130 }, 'O')
    expect(svc.evaluate('B3').status).toBe('CRITICAL')
  })

  it('미집행 시 UNDER_EXECUTED', () => {
    svc.registerItem({ itemId: 'B4', category: '사업비', allocated: 1000, fiscalYear: 2026 }, 'O')
    svc.recordExecution({ itemId: 'B4', period: '2026-01', executed: 100 }, 'O')
    expect(svc.evaluate('B4').status).toBe('UNDER_EXECUTED')
  })

  it('C/S 등급 데이터 차단', () => {
    expect(() =>
      svc.registerItem({ itemId: 'B5', category: '국방', allocated: 100, fiscalYear: 2026 }, 'C')
    ).toThrow(/BLOCKED/)
  })

  it('감사 로그 기록 확인', () => {
    svc.registerItem({ itemId: 'B6', category: '교육', allocated: 100, fiscalYear: 2026 }, 'O')
    svc.recordExecution({ itemId: 'B6', period: '2026-01', executed: 50 }, 'O')
    svc.evaluate('B6')
    const log = svc.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(3)
    expect(log.map((e) => e.action)).toContain('item.register')
  })
})
