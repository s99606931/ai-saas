/**
 * Tests — SVC-AI-ADV-R154 Adversarial Input Detector
 */

import { describe, it, expect } from 'vitest'
import { AdversarialInputDetector } from '../adversarial-input-detector'

function makeDetector(maxLength = 10_000) {
  let t = 1_700_000_000_000
  return new AdversarialInputDetector({
    maxLength,
    now: () => {
      t += 1
      return t
    },
  })
}

describe('AdversarialInputDetector', () => {
  it('정상 텍스트는 pass 로 판정한다', () => {
    const d = makeDetector()
    const r = d.detect('안녕하세요. 오늘 날씨가 좋네요.')
    expect(r.verdict).toBe('pass')
    expect(r.categories).toHaveLength(0)
    expect(r.score).toBe(0)
  })

  it('제로폭 문자를 감지한다', () => {
    const d = makeDetector()
    const r = d.detect('hello\u200Bworld\u200D!')
    expect(r.categories).toContain('zero_width')
  })

  it('50회 이상 반복 문자를 감지한다', () => {
    const d = makeDetector()
    const r = d.detect(`start ${'A'.repeat(60)} end`)
    expect(r.categories).toContain('repetition')
  })

  it('과도 길이를 감지한다', () => {
    const d = makeDetector(100)
    const r = d.detect('x'.repeat(150))
    expect(r.categories).toContain('oversize')
  })

  it('비정상 유니코드(제어 문자) 비율을 감지한다', () => {
    const d = makeDetector()
    // 20자 중 제어 10자 → 50%
    const control = '\u0001'.repeat(10)
    const r = d.detect(`normal text${control}`)
    expect(r.categories).toContain('abnormal_unicode')
  })

  it('Base64 대형 페이로드를 감지한다', () => {
    const d = makeDetector(50_000)
    const payload = 'A'.repeat(2100)
    // repetition 과 겹치지 않도록 섞어서 구성
    const mixed = payload
      .split('')
      .map((c, i) => (i % 5 === 0 ? 'B' : c))
      .join('')
    const r = d.detect(`prefix ${mixed} suffix`)
    expect(r.categories).toContain('encoded_payload')
  })

  it('복합 공격 2가지 이상 → warn 또는 block', () => {
    const d = makeDetector()
    const r = d.detect(`a\u200Bb ${'X'.repeat(60)}`)
    expect(r.categories.length).toBeGreaterThanOrEqual(2)
    expect(['warn', 'block']).toContain(r.verdict)
  })

  it('shouldBlock 헬퍼', () => {
    const d = makeDetector(100)
    // 4가지 카테고리로 score=1
    const input = `\u200B${'X'.repeat(60)}${'\u0001'.repeat(20)}${'A'.repeat(2100)}`
    const r = d.detect(input)
    expect(d.shouldBlock(r)).toBe(true)
  })

  it('빈 입력은 거부된다', () => {
    const d = makeDetector()
    expect(() => d.detect('')).toThrow('invalid_input')
  })

  it('C/S 등급은 차단된다', () => {
    const d = makeDetector()
    expect(() => d.detect('hi', 'C')).toThrow('grade_blocked')
    expect(() => d.detect('hi', 'S')).toThrow('grade_blocked')
  })

  it('감사 로그는 기록된다', () => {
    const d = makeDetector()
    d.detect('hello')
    const log = d.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log[0]?.event).toBe('detected')
  })
})
