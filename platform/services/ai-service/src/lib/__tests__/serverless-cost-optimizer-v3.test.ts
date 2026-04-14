import { describe, it, expect, beforeEach } from 'vitest'
import { ServerlessCostOptimizerV3 } from '../serverless-cost-optimizer-v3'

describe('ServerlessCostOptimizerV3', () => {
  let opt: ServerlessCostOptimizerV3

  beforeEach(() => {
    opt = new ServerlessCostOptimizerV3()
  })

  it('returns null for unknown function', () => {
    expect(opt.optimize('unknown')).toBeNull()
  })

  it('recommends DOWNSIZE when utilization under 50%', () => {
    opt.recordMetrics('f1', 100, 200, 10000, 512)
    const r = opt.optimize('f1')
    expect(r?.action).toBe('DOWNSIZE')
    expect(r?.recommendedMemoryMB).toBeLessThan(512)
  })

  it('recommends UPSIZE when utilization over 90%', () => {
    opt.recordMetrics('f2', 480, 200, 1000, 512)
    const r = opt.optimize('f2')
    expect(r?.action).toBe('UPSIZE')
    expect(r?.recommendedMemoryMB).toBeGreaterThan(512)
  })

  it('recommends KEEP when utilization is moderate', () => {
    opt.recordMetrics('f3', 350, 200, 1000, 512)
    const r = opt.optimize('f3')
    expect(r?.action).toBe('KEEP')
  })

  it('blocks C/S grade data', () => {
    expect(() => opt.recordMetrics('f4', 100, 100, 1000, 512, 'C')).toThrow('BLOCKED')
    expect(() => opt.recordMetrics('f4', 100, 100, 1000, 512, 'S')).toThrow('BLOCKED')
  })

  it('produces audit log entries', () => {
    opt.recordMetrics('f5', 100, 100, 1000, 256)
    opt.optimize('f5')
    const log = opt.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
    expect(log.some((e) => e.action === 'OPTIMIZE')).toBe(true)
  })
})
