// Plan SC: SVC-AI-ADV-R441
import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantCostAllocationOptimizer } from '../multitenant-cost-allocation-optimizer'

describe('MultitenantCostAllocationOptimizer', () => {
  let optimizer: MultitenantCostAllocationOptimizer

  beforeEach(() => {
    optimizer = new MultitenantCostAllocationOptimizer()
  })

  it('addUsage — 감사 로그에 usage.add 기록', () => {
    optimizer.addUsage('tenant-a', 'cpu', 100)
    expect(optimizer.getAuditLog()[0]!.action).toBe('usage.add')
  })

  it('getCostBreakdown — 사용량 비례 비용 배분', () => {
    optimizer.addUsage('tenant-a', 'cpu', 300)
    optimizer.addUsage('tenant-b', 'cpu', 700)
    const breakdown = optimizer.getCostBreakdown(1000)
    const ta = breakdown.find((b) => b.tenantId === 'tenant-a')!
    const tb = breakdown.find((b) => b.tenantId === 'tenant-b')!
    expect(ta.allocatedCost).toBe(300)
    expect(tb.allocatedCost).toBe(700)
  })

  it('getCostBreakdown — 비율 계산', () => {
    optimizer.addUsage('tenant-a', 'cpu', 500)
    optimizer.addUsage('tenant-b', 'cpu', 500)
    const breakdown = optimizer.getCostBreakdown(1000)
    const ta = breakdown.find((b) => b.tenantId === 'tenant-a')!
    expect(ta.ratio).toBe(50)
  })

  it('getOverBudgetTenants — threshold 초과 테넌트 반환', () => {
    optimizer.addUsage('tenant-a', 'cpu', 800)
    optimizer.addUsage('tenant-b', 'cpu', 200)
    const over = optimizer.getOverBudgetTenants(1000, 600)
    expect(over).toHaveLength(1)
    expect(over[0]!.tenantId).toBe('tenant-a')
  })

  it('getCostBreakdown — 사용량 없을 때 빈 배열', () => {
    expect(optimizer.getCostBreakdown(1000)).toHaveLength(0)
  })

  it('addUsage — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => optimizer.addUsage('tenant-a', 'cpu', 100, 'C')).toThrow('BLOCKED')
  })

  it('addUsage — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => optimizer.addUsage('tenant-a', 'cpu', 100, 'S')).toThrow('N2SF N-05')
  })

  it('getOverBudgetTenants — 없을 때 빈 배열', () => {
    optimizer.addUsage('tenant-a', 'cpu', 100)
    const over = optimizer.getOverBudgetTenants(1000, 1001)
    expect(over).toHaveLength(0)
  })
})
