// Plan SC: SVC-AI-ADV-R637
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicApiRateLimiterAI } from '../public-api-rate-limiter-ai'

describe('PublicApiRateLimiterAI', () => {
  let ai: PublicApiRateLimiterAI

  beforeEach(() => {
    ai = new PublicApiRateLimiterAI()
  })

  it('registerClient — 감사 로그 기록', () => {
    ai.registerClient('c1', 'silver')
    expect(ai.getAuditLog()[0]!.action).toBe('client.register')
  })

  it('check — 정상 요청은 allowed', () => {
    ai.registerClient('c1', 'silver')
    const r = ai.check('c1', 1)
    expect(r.allowed).toBe(true)
  })

  it('check — 토큰 고갈 시 거부 + anomaly 증가', () => {
    ai.registerClient('c1', 'bronze')
    const r = ai.check('c1', 10000)
    expect(r.allowed).toBe(false)
    expect(r.anomalyScore).toBeGreaterThan(0)
  })

  it('check — anomaly 80 이상 시 차단 유지', () => {
    ai.registerClient('c1', 'bronze')
    for (let i = 0; i < 20; i++) ai.check('c1', 100000)
    const r = ai.check('c1', 1)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('blocked')
  })

  it('check — 미등록 클라이언트는 에러', () => {
    expect(() => ai.check('unknown')).toThrow()
  })

  it('check — S등급 차단', () => {
    ai.registerClient('c1', 'silver')
    expect(() => ai.check('c1', 1, 'S')).toThrow('BLOCKED')
  })
})
