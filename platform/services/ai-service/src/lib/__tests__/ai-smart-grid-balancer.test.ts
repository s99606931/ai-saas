// Plan SC: SVC-AI-ADV-R640
import { describe, it, expect, beforeEach } from 'vitest'
import { AISmartGridBalancer } from '../ai-smart-grid-balancer'

describe('AISmartGridBalancer', () => {
  let ai: AISmartGridBalancer

  beforeEach(() => {
    ai = new AISmartGridBalancer()
    ai.registerSource({
      sourceId: 'nuke1',
      type: 'nuclear',
      maxOutputMW: 1000,
      currentOutputMW: 800,
      rampRate: 50,
      available: true,
    })
    ai.registerSource({
      sourceId: 'therm1',
      type: 'thermal',
      maxOutputMW: 500,
      currentOutputMW: 200,
      rampRate: 100,
      available: true,
    })
    ai.registerSource({
      sourceId: 'solar1',
      type: 'solar',
      maxOutputMW: 300,
      currentOutputMW: 150,
      rampRate: 200,
      available: true,
    })
  })

  it('registerSource — 감사 로그 기록', () => {
    expect(ai.getAuditLog()[0]!.action).toBe('source.register')
  })

  it('balance — 수요 충족 가능 시 balanced true', () => {
    const s = ai.balance(1000)
    expect(s.balanced).toBe(true)
  })

  it('balance — 원전 우선 디스패치', () => {
    const s = ai.balance(500)
    const nukePlan = s.dispatchPlan.find((p) => p.sourceId === 'nuke1')!
    expect(nukePlan.targetMW).toBeGreaterThan(0)
  })

  it('balance — 용량 초과 수요 시 unbalanced', () => {
    const s = ai.balance(5000)
    expect(s.balanced).toBe(false)
  })

  it('setSourceOutput — 범위 초과 거부', () => {
    expect(() => ai.setSourceOutput('nuke1', 9999)).toThrow()
  })

  it('balance — C등급 차단', () => {
    expect(() => ai.balance(1000, 'C')).toThrow('BLOCKED')
  })
})
