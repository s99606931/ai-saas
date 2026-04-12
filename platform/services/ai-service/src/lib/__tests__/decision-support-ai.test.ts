import { describe, it, expect, beforeEach } from 'vitest'
import { DecisionSupportAI } from '../decision-support-ai'

describe('DecisionSupportAI', () => {
  let ai: DecisionSupportAI

  beforeEach(() => {
    ai = new DecisionSupportAI()
    ai.registerDecision('d1', '클라우드 공급사 선정', [
      { id: 'cost', name: '비용', weight: 3 },
      { id: 'security', name: '보안', weight: 5 },
      { id: 'support', name: '지원', weight: 2 },
    ])
    ai.addAlternative('d1', 'a1', 'A사', { cost: 80, security: 90, support: 70 })
    ai.addAlternative('d1', 'a2', 'B사', { cost: 90, security: 85, support: 80 })
  })

  it('의사결정 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'decision.register')).toBe(true)
  })

  it('가중 합산 점수 계산 및 순위 배정', () => {
    const ranked = ai.rankAlternatives('d1')
    expect(ranked.length).toBe(2)
    expect(ranked[0]?.rank).toBe(1)
    expect(ranked[1]?.rank).toBe(2)
  })

  it('가중 점수 정규화 — 총 가중치 10 기준', () => {
    // a1: cost=80*3/10 + security=90*5/10 + support=70*2/10 = 24+45+14 = 83
    // a2: cost=90*3/10 + security=85*5/10 + support=80*2/10 = 27+42.5+16 = 85.5
    const ranked = ai.rankAlternatives('d1')
    const a2 = ranked.find((r) => r.altId === 'a2')!
    const a1 = ranked.find((r) => r.altId === 'a1')!
    expect(a2.totalScore).toBeGreaterThan(a1.totalScore)
    expect(a2.rank).toBe(1)
  })

  it('최적 대안 반환 — 1위 대안', () => {
    const best = ai.getBestAlternative('d1')
    expect(best.rank).toBe(1)
    expect(best.altId).toBe('a2')
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.addAlternative('d1', 'a3', 'C사', { cost: 70, security: 80, support: 60 }, 'C')).toThrow('BLOCKED')
  })

  it('미등록 의사결정 에러', () => {
    expect(() => ai.rankAlternatives('unknown')).toThrow()
  })

  it('대안 없을 때 getBestAlternative 에러', () => {
    ai.registerDecision('d2', '빈 의사결정', [{ id: 'cost', name: '비용', weight: 1 }])
    expect(() => ai.getBestAlternative('d2')).toThrow()
  })
})
