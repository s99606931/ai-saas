import { describe, it, expect, beforeEach } from 'vitest'
import { PublicProcurementAutomationV4 } from '../public-procurement-automation-v4'

describe('PublicProcurementAutomationV4', () => {
  let svc: PublicProcurementAutomationV4

  beforeEach(() => {
    svc = new PublicProcurementAutomationV4()
  })

  it('classifies HIGH urgency as EMERGENCY / MANUAL_REVIEW', () => {
    const r = svc.classify({
      requestId: 'p1',
      amount: 1_000_000,
      category: 'it',
      urgency: 'HIGH',
      requesterId: 'user-1',
      vendorCount: 1,
    })
    expect(r.procurementType).toBe('EMERGENCY')
    expect(r.decision).toBe('MANUAL_REVIEW')
  })

  it('classifies small amount with vendor as DIRECT / AUTO_APPROVE', () => {
    const r = svc.classify({
      requestId: 'p2',
      amount: 5_000_000,
      category: 'it',
      urgency: 'LOW',
      requesterId: 'user-2',
      vendorCount: 1,
    })
    expect(r.procurementType).toBe('DIRECT')
    expect(r.decision).toBe('AUTO_APPROVE')
  })

  it('classifies medium amount with 3 vendors as LIMITED_BID / AUTO_APPROVE', () => {
    const r = svc.classify({
      requestId: 'p3',
      amount: 30_000_000,
      category: 'it',
      urgency: 'LOW',
      requesterId: 'user-3',
      vendorCount: 3,
    })
    expect(r.procurementType).toBe('LIMITED_BID')
    expect(r.decision).toBe('AUTO_APPROVE')
  })

  it('classifies large amount as OPEN_BID / MANUAL_REVIEW', () => {
    const r = svc.classify({
      requestId: 'p4',
      amount: 100_000_000,
      category: 'it',
      urgency: 'LOW',
      requesterId: 'user-4',
      vendorCount: 5,
    })
    expect(r.procurementType).toBe('OPEN_BID')
    expect(r.decision).toBe('MANUAL_REVIEW')
  })

  it('rejects when vendor count is insufficient', () => {
    const r = svc.classify({
      requestId: 'p5',
      amount: 30_000_000,
      category: 'it',
      urgency: 'LOW',
      requesterId: 'user-5',
      vendorCount: 1,
    })
    expect(r.decision).toBe('REJECT')
  })

  it('blocks C/S grade and masks requesterId in audit log', () => {
    expect(() =>
      svc.classify(
        { requestId: 'x', amount: 1, category: 'it', urgency: 'LOW', requesterId: 'u', vendorCount: 1 },
        'C',
      ),
    ).toThrow('BLOCKED')
    svc.classify(
      { requestId: 'p6', amount: 1_000_000, category: 'it', urgency: 'LOW', requesterId: 'alice@ex.com', vendorCount: 1 },
    )
    const entry = svc.getAuditLog().find((e) => e.action === 'CLASSIFY_PROCUREMENT')
    expect(entry?.actor).not.toBe('alice@ex.com')
    expect(String(entry?.actor)).toHaveLength(16)
  })
})
