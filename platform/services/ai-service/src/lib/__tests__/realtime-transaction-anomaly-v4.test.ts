import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeTransactionAnomalyV4 } from '../realtime-transaction-anomaly-v4'

describe('RealtimeTransactionAnomalyV4', () => {
  let svc: RealtimeTransactionAnomalyV4

  beforeEach(() => {
    svc = new RealtimeTransactionAnomalyV4()
  })

  const mk = (txId: string, amount: number, timestamp: number) => ({
    txId,
    userId: 'user-1',
    amount,
    timestamp,
    merchantCategory: 'retail',
  })

  it('returns NORMAL for first small transaction', () => {
    const r = svc.analyze(mk('t1', 10000, 1000))
    expect(r.severity).toBe('NORMAL')
  })

  it('flags single large transaction as WARNING', () => {
    const r = svc.analyze(mk('t2', 20_000_000, 1000))
    expect(r.severity).toBe('WARNING')
    expect(r.reasons.some((x) => x.includes('1천만원'))).toBe(true)
  })

  it('flags rapid-fire as WARNING or higher', () => {
    svc.analyze(mk('a', 1000, 1000))
    svc.analyze(mk('b', 1000, 2000))
    svc.analyze(mk('c', 1000, 3000))
    const r = svc.analyze(mk('d', 1000, 4000))
    expect(['WARNING', 'CRITICAL']).toContain(r.severity)
  })

  it('escalates to CRITICAL when multiple rules trigger', () => {
    svc.analyze(mk('a', 1000, 1000))
    svc.analyze(mk('b', 1000, 2000))
    svc.analyze(mk('c', 1000, 3000))
    const r = svc.analyze(mk('d', 20_000_000, 4000))
    expect(r.severity).toBe('CRITICAL')
  })

  it('blocks C/S grade data', () => {
    expect(() => svc.analyze(mk('x', 1000, 1), 'C')).toThrow('BLOCKED')
    expect(() => svc.analyze(mk('x', 1000, 1), 'S')).toThrow('BLOCKED')
  })

  it('masks userId in audit log', () => {
    svc.analyze(mk('t', 1000, 1))
    const entry = svc.getAuditLog().find((e) => e.action === 'ANALYZE_TX')
    expect(entry?.actor).not.toBe('user-1')
    expect(String(entry?.actor)).toHaveLength(16)
  })
})
