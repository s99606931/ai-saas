import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeTransactionAnomalyV3 } from '../realtime-transaction-anomaly-v3'

describe('RealtimeTransactionAnomalyV3', () => {
  let detector: RealtimeTransactionAnomalyV3

  beforeEach(() => { detector = new RealtimeTransactionAnomalyV3() })

  it('should register a rule', () => {
    detector.registerRule('r1', 'Large Transfer', 1000000)
    expect(detector.getAuditLog().length).toBeGreaterThan(0)
  })

  it('should detect anomalous transaction exceeding max amount', () => {
    detector.registerRule('r1', 'Large Transfer', 1000000)
    detector.recordTransaction('tx1', 'user-1', 2000000, 'r1')
    expect(detector.isAnomalous('tx1')).toBe(true)
  })

  it('should not flag normal transaction', () => {
    detector.registerRule('r1', 'Large Transfer', 1000000)
    detector.recordTransaction('tx1', 'user-1', 500000, 'r1')
    expect(detector.isAnomalous('tx1')).toBe(false)
  })

  it('should return all anomalous transactions', () => {
    detector.registerRule('r1', 'RL', 100)
    detector.recordTransaction('tx1', 'u1', 200, 'r1')
    detector.recordTransaction('tx2', 'u2', 50, 'r1')
    const anomalous = detector.getAnomalousTransactions()
    expect(anomalous.map((t: { txId: string }) => t.txId)).toContain('tx1')
    expect(anomalous.map((t: { txId: string }) => t.txId)).not.toContain('tx2')
  })

  it('should mask userId in audit log', () => {
    detector.registerRule('r1', 'RL', 1000)
    detector.recordTransaction('tx1', 'citizen-xyz', 500, 'r1')
    const log = detector.getAuditLog()
    const entry = log.find((e: { action: string }) => e.action === 'RECORD_TRANSACTION')
    expect(entry?.details?.maskedUserId).not.toBe('citizen-xyz')
    expect(entry?.details?.maskedUserId).toHaveLength(16)
  })

  it('should block C grade data', () => {
    detector.registerRule('r1', 'RL', 1000)
    expect(() => detector.recordTransaction('tx1', 'u1', 500, 'r1', 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    detector.registerRule('r1', 'RL', 1000)
    expect(() => detector.recordTransaction('tx1', 'u1', 500, 'r1', 'S')).toThrow('BLOCKED')
  })
})
