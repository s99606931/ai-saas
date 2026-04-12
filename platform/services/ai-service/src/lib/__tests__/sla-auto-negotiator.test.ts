/**
 * SLA 자동 협상 엔진 단위 테스트 — SVC-AI-ADV-R156
 * Plan SC: FR-R156.1 ~ FR-R156.5
 */

import { describe, it, expect } from 'vitest'
import { SLAAutoNegotiator, DataGrade } from '../sla-auto-negotiator'

const defaultCapability = {
  maxAvailability: 99.9,
  minResponseTimeMs: 100,
  minRtoMinutes: 30,
  minRpoMinutes: 15,
}

describe('SLAAutoNegotiator — R156', () => {
  it('FR-R156.1: O등급 인스턴스 생성 성공', () => {
    expect(() => new SLAAutoNegotiator(DataGrade.O, defaultCapability)).not.toThrow()
  })

  it('FR-R156.2: 3개 제안 생성 (conservative/standard/aggressive)', () => {
    const neg = new SLAAutoNegotiator(DataGrade.O, defaultCapability)
    const result = neg.analyze({ availabilityPercent: 99.5, responseTimeMs: 200, rtoMinutes: 60, rpoMinutes: 30 })
    expect(result.proposals).toHaveLength(3)
    const tiers = result.proposals.map((p) => p.tier)
    expect(tiers).toContain('conservative')
    expect(tiers).toContain('standard')
    expect(tiers).toContain('aggressive')
  })

  it('FR-R156.3: recommended 필드 포함', () => {
    const neg = new SLAAutoNegotiator(DataGrade.O, defaultCapability)
    const result = neg.analyze({ availabilityPercent: 99.0, responseTimeMs: 300, rtoMinutes: 120, rpoMinutes: 60 })
    expect(result.recommended).toBeDefined()
    expect(['conservative', 'standard', 'aggressive']).toContain(result.recommended.tier)
  })

  it('FR-R156.3: midpoint 계산 포함', () => {
    const neg = new SLAAutoNegotiator(DataGrade.O, defaultCapability)
    const req = { availabilityPercent: 99.0, responseTimeMs: 200, rtoMinutes: 60, rpoMinutes: 30 }
    const result = neg.analyze(req)
    expect(result.midpoint.availabilityPercent).toBeCloseTo((99.0 + 99.9) / 2)
  })

  it('FR-R156.4: simulate midpoint 협상', () => {
    const neg = new SLAAutoNegotiator(DataGrade.O, defaultCapability)
    const client = { availabilityPercent: 99.9, responseTimeMs: 100, rtoMinutes: 30, rpoMinutes: 15 }
    const provider = { availabilityPercent: 99.0, responseTimeMs: 200, rtoMinutes: 60, rpoMinutes: 30 }
    const mid = neg.simulate(client, provider)
    expect(mid.availabilityPercent).toBeCloseTo((99.9 + 99.0) / 2)
    expect(mid.responseTimeMs).toBeCloseTo((100 + 200) / 2)
  })

  it('FR-R156.5: audit log 기록 — analyze 후 audit 항목', () => {
    const neg = new SLAAutoNegotiator(DataGrade.O, defaultCapability)
    neg.analyze({ availabilityPercent: 99.5, responseTimeMs: 200, rtoMinutes: 60, rpoMinutes: 30 })
    const log = neg.getAuditLog()
    expect(log.some((e) => e.action === 'analyzed')).toBe(true)
  })

  it('FR-R156.5: audit log append-only', () => {
    const neg = new SLAAutoNegotiator(DataGrade.O, defaultCapability)
    neg.analyze({ availabilityPercent: 99.5, responseTimeMs: 200, rtoMinutes: 60, rpoMinutes: 30 })
    const log1 = neg.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = neg.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new SLAAutoNegotiator(DataGrade.C, defaultCapability)).toThrow('BLOCKED')
    expect(() => new SLAAutoNegotiator(DataGrade.S, defaultCapability)).toThrow('BLOCKED')
  })

  it('availabilityPercent 범위 초과 throw', () => {
    const neg = new SLAAutoNegotiator(DataGrade.O, defaultCapability)
    expect(() => neg.analyze({ availabilityPercent: 110, responseTimeMs: 200, rtoMinutes: 60, rpoMinutes: 30 }))
      .toThrow('availabilityPercent')
  })
})
