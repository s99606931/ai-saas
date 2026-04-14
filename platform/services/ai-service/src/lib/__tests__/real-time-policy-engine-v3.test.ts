import { describe, it, expect, beforeEach } from 'vitest'
import { RealTimePolicyEngineV3 } from '../real-time-policy-engine-v3'

describe('RealTimePolicyEngineV3', () => {
  let svc: RealTimePolicyEngineV3
  beforeEach(() => { svc = new RealTimePolicyEngineV3() })

  it('FR-R635.1: register policy', () => {
    svc.registerPolicy('p1', e => e['value'] !== undefined)
    expect(svc.evaluate({ value: 1 })).toEqual([])
  })

  it('FR-R635.2: blocks C grade', () => {
    svc.registerPolicy('p1', () => true)
    expect(() => svc.evaluate({ a: 1 }, 'C')).toThrow('BLOCKED')
  })

  it('FR-R635.2: detects violation', () => {
    svc.registerPolicy('p1', e => (e['level'] as number) < 5)
    const v = svc.evaluate({ level: 10 })
    expect(v.length).toBe(1)
  })

  it('FR-R635.3: returns accumulated violations', () => {
    svc.registerPolicy('p1', () => false)
    svc.evaluate({ a: 1 })
    svc.evaluate({ a: 2 })
    expect(svc.getViolations().length).toBe(2)
  })

  it('FR-R635.4: violation rate computation', () => {
    svc.registerPolicy('p1', e => (e['ok'] as boolean) === true)
    svc.evaluate({ ok: true })
    svc.evaluate({ ok: false })
    svc.evaluate({ ok: false })
    expect(svc.violationRate('p1')).toBeCloseTo(2 / 3, 5)
  })

  it('FR-R635.5: audit log populated', () => {
    svc.registerPolicy('p1', () => true)
    svc.evaluate({ a: 1 })
    expect(svc.getAuditLog().some(e => e.action === 'EVALUATE')).toBe(true)
  })
})
