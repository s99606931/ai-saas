/**
 * Tests — SVC-AI-ADV-R150 Sentiment-Based Router
 */

import { describe, it, expect } from 'vitest'
import { SentimentBasedRouter } from '../sentiment-based-router'

function makeRouter() {
  let t = 1_700_000_000_000
  return new SentimentBasedRouter({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('SentimentBasedRouter', () => {
  it('중립 텍스트 → LOW', () => {
    const r = makeRouter()
    const d = r.route('안녕하세요, 문서 발급 문의드립니다')
    expect(d.queue).toBe('LOW')
    expect(d.score).toBeLessThan(0.3)
  })

  it('부정 키워드 한 개 → NORMAL', () => {
    const r = makeRouter()
    const d = r.route('서비스가 너무 실망스럽습니다')
    expect(d.negativeHits.length).toBeGreaterThanOrEqual(1)
    expect(d.queue).toBe('NORMAL')
  })

  it('긴급 키워드 단독 → NORMAL 이상', () => {
    const r = makeRouter()
    const d = r.route('긴급하게 처리 부탁드립니다')
    expect(d.urgencyHits.length).toBeGreaterThanOrEqual(1)
    expect(d.queue === 'NORMAL' || d.queue === 'HIGH').toBe(true)
  })

  it('부정+긴급 → HIGH', () => {
    const r = makeRouter()
    const d = r.route('너무 억울하고 분노가 치밀어요. 당장 긴급 응급 처리 해주세요')
    expect(d.queue).toBe('HIGH')
    expect(d.score).toBeGreaterThanOrEqual(0.7)
  })

  it('매우 강한 부정만으로도 가능', () => {
    const r = makeRouter()
    const d = r.route('최악 최악 억울 억울 분노 분노 화가 화가')
    expect(d.negativeScore).toBe(1)
  })

  it('영어 키워드 감지', () => {
    const r = makeRouter()
    const d = r.route('This is urgent and critical emergency')
    expect(d.urgencyHits.length).toBeGreaterThanOrEqual(3)
    expect(d.queue).toBe('HIGH')
  })

  it('대소문자 무관', () => {
    const r = makeRouter()
    const d1 = r.route('URGENT help')
    const d2 = r.route('urgent help')
    expect(d1.urgencyHits.length).toBe(d2.urgencyHits.length)
  })

  it('addNegativeKeyword 추가', () => {
    const r = makeRouter()
    r.addNegativeKeyword('형편없', 0.4)
    const d = r.route('서비스가 형편없네요')
    expect(d.negativeHits.some((h) => h.term === '형편없')).toBe(true)
  })

  it('addUrgencyKeyword 추가', () => {
    const r = makeRouter()
    r.addUrgencyKeyword('사망', 0.9)
    const d = r.route('사망 사건 발생')
    expect(d.urgencyHits.some((h) => h.term === '사망')).toBe(true)
  })

  it('빈 text invalid_input', () => {
    const r = makeRouter()
    expect(() => r.route('')).toThrow('invalid_input')
    expect(() => r.route('   ')).toThrow('invalid_input')
  })

  it('잘못된 키워드 거부', () => {
    const r = makeRouter()
    expect(() => r.addNegativeKeyword('', 0.5)).toThrow('invalid_keyword')
    expect(() => r.addUrgencyKeyword('x', 0)).toThrow('invalid_keyword')
    expect(() => r.addUrgencyKeyword('x', -1)).toThrow('invalid_keyword')
  })

  it('C/S등급 차단', () => {
    const r = makeRouter()
    expect(() => r.route('test', 'C')).toThrow('grade_blocked')
    expect(() => r.route('test', 'S')).toThrow('grade_blocked')
  })

  it('score cap 1', () => {
    const r = makeRouter()
    const d = r.route('생명 위독 응급 긴급 분노 최악 억울 화가')
    expect(d.score).toBeLessThanOrEqual(1)
  })

  it('getAuditLog', () => {
    const r = makeRouter()
    r.route('test 긴급')
    r.addNegativeKeyword('bad', 0.3)
    const log = r.getAuditLog()
    expect(log.some((e) => e.event === 'route_decided')).toBe(true)
    expect(log.some((e) => e.event === 'neg_added')).toBe(true)
  })

  it('negativeScore와 urgencyScore 분리 집계', () => {
    const r = makeRouter()
    const d = r.route('분노 응급')
    expect(d.negativeScore).toBeGreaterThan(0)
    expect(d.urgencyScore).toBeGreaterThan(0)
  })
})
