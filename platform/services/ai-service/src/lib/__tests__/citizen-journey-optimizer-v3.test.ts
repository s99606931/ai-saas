// Plan SC: SVC-AI-ADV-R616
import { describe, it, expect, beforeEach } from 'vitest'
import { CitizenJourneyOptimizerV3 } from '../citizen-journey-optimizer-v3'

describe('CitizenJourneyOptimizerV3', () => {
  let o: CitizenJourneyOptimizerV3

  beforeEach(() => {
    o = new CitizenJourneyOptimizerV3()
  })

  it('defineStep — 감사 로그', () => {
    o.defineStep('s1', 1000)
    expect(o.getAuditLog()[0]!.action).toBe('step.define')
  })

  it('analyzeStep — 정상 완료', () => {
    o.defineStep('s1', 1000)
    o.recordEvent({ citizenId: 'u1', stepId: 's1', durationMs: 800, completed: true })
    o.recordEvent({ citizenId: 'u2', stepId: 's1', durationMs: 900, completed: true })
    const m = o.analyzeStep('s1')
    expect(m.dropRate).toBe(0)
    expect(m.bottleneck).toBe(false)
  })

  it('analyzeStep — 이탈률 높아 병목', () => {
    o.defineStep('s1', 1000)
    for (let i = 0; i < 7; i++) {
      o.recordEvent({ citizenId: `u${i}`, stepId: 's1', durationMs: 0, completed: false })
    }
    for (let i = 0; i < 3; i++) {
      o.recordEvent({ citizenId: `u${i + 7}`, stepId: 's1', durationMs: 500, completed: true })
    }
    const m = o.analyzeStep('s1')
    expect(m.bottleneck).toBe(true)
    expect(m.suggestion).toContain('단순화')
  })

  it('analyzeStep — 평균 소요 초과로 병목', () => {
    o.defineStep('s1', 1000)
    o.recordEvent({ citizenId: 'u1', stepId: 's1', durationMs: 2000, completed: true })
    o.recordEvent({ citizenId: 'u2', stepId: 's1', durationMs: 2500, completed: true })
    const m = o.analyzeStep('s1')
    expect(m.bottleneck).toBe(true)
    expect(m.suggestion).toContain('자동화')
  })

  it('recordEvent — citizenId 마스킹 + C/S 차단', () => {
    o.defineStep('s1', 1000)
    o.recordEvent({ citizenId: 'kim@a.kr', stepId: 's1', durationMs: 500, completed: true })
    const log = o.getAuditLog()
    const rec = log.find((l) => l.action === 'event.record')!
    expect(rec.details!.citizen).toMatch(/^[0-9a-f]{16}$/)
    expect(() =>
      o.recordEvent({ citizenId: 'x', stepId: 's1', durationMs: 0, completed: true }, 'S')
    ).toThrow(/BLOCKED/)
  })

  it('getBottlenecks — 병목 단계만 반환', () => {
    o.defineStep('s1', 1000)
    o.defineStep('s2', 1000)
    o.recordEvent({ citizenId: 'u1', stepId: 's1', durationMs: 500, completed: true })
    for (let i = 0; i < 5; i++) {
      o.recordEvent({ citizenId: `u${i}`, stepId: 's2', durationMs: 0, completed: false })
    }
    const bs = o.getBottlenecks()
    expect(bs).toHaveLength(1)
    expect(bs[0]!.stepId).toBe('s2')
  })
})
