import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetExecutionAnomaly } from '../budget-execution-anomaly'

describe('BudgetExecutionAnomaly', () => {
  let b: BudgetExecutionAnomaly

  beforeEach(() => {
    b = new BudgetExecutionAnomaly()
  })

  const mkEx = (id: string, amount: number, date: string, supplier = 'sup-1') => ({
    executionId: id,
    agencyId: 'agency-A',
    account: 'acct-1',
    amount,
    supplierId: supplier,
    date,
  })

  it('budget limit 양수 검증', () => {
    expect(() => b.setBudget('a', 'x', -1, 'c')).toThrow('limit')
  })

  it('amount 양수 검증', () => {
    expect(() => b.recordExecution(mkEx('e1', 0, '2026-04-01'), 'O', 'a')).toThrow('amount')
  })

  it('C등급 차단', () => {
    expect(() => b.recordExecution(mkEx('e1', 100, '2026-04-01'), 'C', 'a')).toThrow('BLOCKED')
  })

  it('중복 executionId 차단', () => {
    b.recordExecution(mkEx('e1', 100, '2026-04-01'), 'O', 'a')
    expect(() => b.recordExecution(mkEx('e1', 200, '2026-04-02'), 'O', 'a')).toThrow('중복')
  })

  it('통계 이상치 — 극단값 탐지', () => {
    // 유사한 금액 5개 + 극단값 1개
    b.recordExecution(mkEx('e1', 100, '2026-04-01'), 'O', 'a')
    b.recordExecution(mkEx('e2', 110, '2026-04-02'), 'O', 'a')
    b.recordExecution(mkEx('e3', 105, '2026-04-03', 'sup-2'), 'O', 'a')
    b.recordExecution(mkEx('e4', 95, '2026-04-04', 'sup-3'), 'O', 'a')
    b.recordExecution(mkEx('e5', 100, '2026-04-05', 'sup-4'), 'O', 'a')
    b.recordExecution(mkEx('e6', 10000, '2026-04-06', 'sup-5'), 'O', 'a')
    const anoms = b.detectAnomalies()
    const stat = anoms.find((a) => a.type === 'STATISTICAL' && a.executionId === 'e6')
    expect(stat).toBeDefined()
    expect(['MED', 'HIGH']).toContain(stat?.severity)
  })

  it('통계 이상치 — 샘플 부족 시 없음', () => {
    b.recordExecution(mkEx('e1', 100, '2026-04-01'), 'O', 'a')
    b.recordExecution(mkEx('e2', 10000, '2026-04-02', 'sup-2'), 'O', 'a')
    const anoms = b.detectAnomalies()
    expect(anoms.filter((a) => a.type === 'STATISTICAL')).toHaveLength(0)
  })

  it('중복 거래 탐지 — 7일 이내', () => {
    b.recordExecution(mkEx('e1', 500, '2026-04-01', 'sup-dup'), 'O', 'a')
    b.recordExecution(mkEx('e2', 500, '2026-04-05', 'sup-dup'), 'O', 'a')
    const anoms = b.detectAnomalies()
    const dup = anoms.find((a) => a.type === 'DUPLICATE')
    expect(dup).toBeDefined()
    expect(dup?.severity).toBe('HIGH')
  })

  it('중복 거래 — 7일 초과 미탐지', () => {
    b.recordExecution(mkEx('e1', 500, '2026-04-01', 'sup-dup'), 'O', 'a')
    b.recordExecution(mkEx('e2', 500, '2026-04-10', 'sup-dup'), 'O', 'a')
    const anoms = b.detectAnomalies()
    expect(anoms.filter((a) => a.type === 'DUPLICATE')).toHaveLength(0)
  })

  it('중복 거래 — 금액 다르면 미탐지', () => {
    b.recordExecution(mkEx('e1', 500, '2026-04-01', 'sup-dup'), 'O', 'a')
    b.recordExecution(mkEx('e2', 600, '2026-04-02', 'sup-dup'), 'O', 'a')
    const anoms = b.detectAnomalies()
    expect(anoms.filter((a) => a.type === 'DUPLICATE')).toHaveLength(0)
  })

  it('예산 초과 탐지', () => {
    b.setBudget('agency-A', 'acct-1', 1000, 'admin')
    b.recordExecution(mkEx('e1', 600, '2026-04-01'), 'O', 'a')
    b.recordExecution(mkEx('e2', 500, '2026-04-02', 'sup-2'), 'O', 'a')
    const anoms = b.detectAnomalies()
    const over = anoms.find((a) => a.type === 'OVER_BUDGET')
    expect(over).toBeDefined()
    expect(over?.severity).toBe('HIGH')
  })

  it('예산 내 집행 — 미탐지', () => {
    b.setBudget('agency-A', 'acct-1', 10000, 'admin')
    b.recordExecution(mkEx('e1', 100, '2026-04-01'), 'O', 'a')
    const anoms = b.detectAnomalies()
    expect(anoms.filter((a) => a.type === 'OVER_BUDGET')).toHaveLength(0)
  })

  it('감사 로그 — caller 마스킹', () => {
    b.recordExecution(mkEx('e1', 100, '2026-04-01'), 'O', 'caller-long')
    const log = b.getAuditLog()
    const rec = log.find((e) => e.action === 'execution.record')
    expect(rec?.callerMasked).toContain('***')
  })

  it('빈 이상치 — 이벤트 없음', () => {
    const anoms = b.detectAnomalies()
    expect(anoms).toHaveLength(0)
  })

  it('다수 이상치 동시 탐지', () => {
    b.setBudget('agency-A', 'acct-1', 1000, 'admin')
    for (let i = 0; i < 5; i++) {
      b.recordExecution(mkEx(`e${i}`, 100, `2026-04-0${i + 1}`, `s${i}`), 'O', 'a')
    }
    // 예산 초과 + 극단값 (900)
    b.recordExecution(mkEx('big', 900, '2026-04-10', 's-big'), 'O', 'a')
    const anoms = b.detectAnomalies()
    expect(anoms.length).toBeGreaterThanOrEqual(2)
  })
})
