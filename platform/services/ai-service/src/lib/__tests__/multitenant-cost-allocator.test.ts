import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantCostAllocator } from '../multitenant-cost-allocator'

describe('MultitenantCostAllocator', () => {
  let allocator: MultitenantCostAllocator
  const FROM = 1000
  const TO = 2000

  beforeEach(() => {
    allocator = new MultitenantCostAllocator()
    allocator.registerTenant({ tenantId: 'T1', name: '기관A', tier: 'basic' })
    allocator.registerTenant({ tenantId: 'T2', name: '기관B', tier: 'standard' })
    allocator.registerTenant({ tenantId: 'T3', name: '기관C', tier: 'premium' })
  })

  it('미등록 테넌트 사용량 기록 시 오류', () => {
    expect(() => allocator.recordUsage('UNKNOWN', 'cpu', 10, 1500)).toThrow('Unknown tenant')
  })

  it('음수 사용량 기록 시 오류', () => {
    expect(() => allocator.recordUsage('T1', 'cpu', -1, 1500)).toThrow('non-negative')
  })

  it('basic 테넌트 최소 요금 적용 (subtotal < 10000)', () => {
    allocator.recordUsage('T1', 'api_call', 1, 1500)  // 0.1원
    const invoice = allocator.calculateCost('T1', { from: FROM, to: TO })
    expect(invoice.total).toBe(10000)
    expect(invoice.minimumFee).toBe(10000)
  })

  it('standard 테넌트 10% 할인 적용', () => {
    allocator.recordUsage('T2', 'cpu', 1000, 1500)  // 50원 * 1000 = 50000원 * 0.9 = 45000
    const invoice = allocator.calculateCost('T2', { from: FROM, to: TO })
    expect(invoice.lineItems[0]!.unitPrice).toBeCloseTo(45)
    expect(invoice.subtotal).toBeCloseTo(45000)
    expect(invoice.total).toBe(50000)  // minimum fee 50000 > 45000
  })

  it('premium 테넌트 20% 할인 + 최소 200000 적용', () => {
    allocator.recordUsage('T3', 'cpu', 100, 1500)  // 50 * 0.8 * 100 = 4000 < 200000
    const invoice = allocator.calculateCost('T3', { from: FROM, to: TO })
    expect(invoice.total).toBe(200000)
  })

  it('generateInvoice는 calculateCost와 동일한 결과 + 감사 기록 추가', () => {
    allocator.recordUsage('T1', 'memory', 100, 1500)
    const invoice = allocator.generateInvoice('T1', { from: FROM, to: TO })
    expect(invoice.tenantId).toBe('T1')
    const log = allocator.getAuditLog()
    expect(log.some((e) => e.action === 'invoice.generate')).toBe(true)
  })

  it('기간 밖 사용량 제외', () => {
    allocator.recordUsage('T1', 'storage', 999999, 999)  // FROM 이전
    const invoice = allocator.calculateCost('T1', { from: FROM, to: TO })
    expect(invoice.lineItems.length).toBe(0)
    expect(invoice.total).toBe(10000)
  })

  it('감사 로그 복사본 반환', () => {
    allocator.calculateCost('T1', { from: FROM, to: TO })
    const log = allocator.getAuditLog()
    log.push({ timestamp: '', action: 'injected', tenantId: 'X', detail: {} })
    expect(allocator.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
