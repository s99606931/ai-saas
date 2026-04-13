// Plan SC: SVC-AI-ADV-R376
import { describe, it, expect, beforeEach } from 'vitest'
import { DecisionSupportSystemAI } from '../decision-support-system-ai'

describe('DecisionSupportSystemAI', () => {
  let system: DecisionSupportSystemAI

  beforeEach(() => {
    system = new DecisionSupportSystemAI()
  })

  it('registerCriterion — 감사 로그에 criterion.register 기록', () => {
    system.registerCriterion('c1', '비용', 0.4)
    const log = system.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('criterion.register')
    expect(log[0]!.detail).toBe('c1')
  })

  it('evaluateAlternatives — 가중 합산 점수 계산 및 rank 부여', () => {
    system.registerCriterion('c1', '비용', 0.6)
    system.registerCriterion('c2', '효율', 0.4)
    system.registerAlternative('a1', '대안A', { c1: 80, c2: 90 })
    system.registerAlternative('a2', '대안B', { c1: 70, c2: 60 })
    const results = system.evaluateAlternatives()
    // a1: 80*0.6/1.0 + 90*0.4/1.0 = 48+36 = 84
    // a2: 70*0.6 + 60*0.4 = 42+24 = 66
    expect(results[0]!.alternativeId).toBe('a1')
    expect(results[0]!.totalScore).toBeCloseTo(84, 1)
    expect(results[0]!.rank).toBe(1)
    expect(results[1]!.rank).toBe(2)
  })

  it('getBestAlternative — 점수 최고 대안 반환', () => {
    system.registerCriterion('c1', '비용', 1)
    system.registerAlternative('a1', '대안A', { c1: 90 })
    system.registerAlternative('a2', '대안B', { c1: 70 })
    const best = system.getBestAlternative()
    expect(best.alternativeId).toBe('a1')
  })

  it('evaluateAlternatives — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => system.evaluateAlternatives('C')).toThrow('BLOCKED')
  })

  it('evaluateAlternatives — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => system.evaluateAlternatives('S')).toThrow('N2SF N-05')
  })

  it('getBestAlternative — C등급 차단', () => {
    expect(() => system.getBestAlternative('C')).toThrow('BLOCKED')
  })

  it('evaluateAlternatives — 대안 없을 때 빈 배열', () => {
    system.registerCriterion('c1', '비용', 1)
    const results = system.evaluateAlternatives()
    expect(results).toHaveLength(0)
  })

  it('getBestAlternative — 대안 없을 때 에러', () => {
    system.registerCriterion('c1', '비용', 1)
    expect(() => system.getBestAlternative()).toThrow('등록된 대안이 없습니다')
  })
})
