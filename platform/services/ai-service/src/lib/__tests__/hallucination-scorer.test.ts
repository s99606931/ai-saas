/**
 * Tests — SVC-AI-ADV-R160 Hallucination Scorer
 */

import { describe, it, expect } from 'vitest'
import { HallucinationScorer } from '../hallucination-scorer'

function makeScorer() {
  let t = 1_700_000_000_000
  return new HallucinationScorer({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('HallucinationScorer', () => {
  it('근거 충분 + 일치도 높음 → low', () => {
    const s = makeScorer()
    const r = s.score(
      '민원 접수는 온라인 포털에서 가능합니다',
      ['민원 접수는 온라인 포털에서 가능하며 24시간 운영됩니다'],
    )
    expect(r.level).toBe('low')
    expect(r.score).toBeLessThan(0.3)
  })

  it('citations 비어있으면 high (0.9)', () => {
    const s = makeScorer()
    const r = s.score('어떤 응답', [])
    expect(r.level).toBe('high')
    expect(r.score).toBeGreaterThanOrEqual(0.9)
    expect(r.reasons.some((x) => x.includes('citations_empty'))).toBe(true)
  })

  it('불확실 표현 포함 시 점수 가중', () => {
    const s = makeScorer()
    const r = s.score(
      '아마 민원 접수는 온라인 포털일 것 같습니다',
      ['민원 접수는 온라인 포털에서 가능합니다'],
    )
    expect(r.reasons.some((x) => x.includes('hedge_detected'))).toBe(true)
  })

  it('빈 응답은 empty_response throw', () => {
    const s = makeScorer()
    expect(() => s.score('', ['근거'])).toThrow('empty_response')
    expect(() => s.score('   ', ['근거'])).toThrow('empty_response')
  })

  it('reasons 배열에 산출 근거 포함', () => {
    const s = makeScorer()
    const r = s.score('응답 내용', ['전혀 다른 근거'])
    expect(r.reasons.length).toBeGreaterThan(0)
    expect(r.reasons.some((x) => x.includes('overlap_ratio'))).toBe(true)
  })

  it('근거 불일치 → high score', () => {
    const s = makeScorer()
    const r = s.score('완전히 다른 내용의 응답이다', ['전혀 관계없는 다른 주제'])
    expect(r.score).toBeGreaterThan(0.5)
  })

  it('C/S 등급 차단', () => {
    const s = makeScorer()
    expect(() => s.score('응답', ['근거'], 'C')).toThrow('grade_blocked')
    expect(() => s.score('응답', ['근거'], 'S')).toThrow('grade_blocked')
  })

  it('통계는 평균과 level별 카운트를 집계', () => {
    const s = makeScorer()
    s.score('응답1', ['응답1'])
    s.score('응답2', [])
    const stats = s.getStats()
    expect(stats.total).toBe(2)
    expect(stats.averageScore).toBeGreaterThan(0)
    expect(stats.levels.high).toBeGreaterThanOrEqual(1)
  })

  it('감사 로그가 scored 이벤트를 기록', () => {
    const s = makeScorer()
    s.score('응답', ['근거'])
    const log = s.getAuditLog()
    expect(log.map((l) => l.event)).toContain('scored')
  })

  it('invalid citations 거부', () => {
    const s = makeScorer()
    expect(() => s.score('응답', null as unknown as string[])).toThrow('invalid_citations')
  })
})
