/**
 * Tests — SVC-AI-ADV-R151 Document Redaction Engine
 */

import { describe, it, expect } from 'vitest'
import { DocumentRedactionEngine } from '../document-redaction-engine'

function makeEngine() {
  let t = 1_700_000_000_000
  return new DocumentRedactionEngine({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('DocumentRedactionEngine', () => {
  it('주민번호 마스킹', () => {
    const e = makeEngine()
    const r = e.redact('주민번호는 901234-1234567 입니다')
    expect(r.redacted).toContain('[REDACTED:rrn]')
    expect(r.redacted).not.toContain('901234-1234567')
    expect(r.hits.some((h) => h.type === 'rrn')).toBe(true)
  })

  it('이메일 마스킹', () => {
    const e = makeEngine()
    const r = e.redact('문의: user@example.com 로 연락주세요')
    expect(r.redacted).toContain('[REDACTED:email]')
    expect(r.hits.some((h) => h.type === 'email')).toBe(true)
  })

  it('전화번호 010 마스킹', () => {
    const e = makeEngine()
    const r = e.redact('전화: 010-1234-5678')
    expect(r.redacted).toContain('[REDACTED:phone]')
  })

  it('전화번호 02 마스킹', () => {
    const e = makeEngine()
    const r = e.redact('사무실 02-123-4567')
    expect(r.redacted).toContain('[REDACTED:phone]')
  })

  it('계좌번호 마스킹', () => {
    const e = makeEngine()
    const r = e.redact('계좌번호 123456-01-123456')
    expect(r.redacted).toContain('[REDACTED:account]')
  })

  it('여권번호 마스킹', () => {
    const e = makeEngine()
    const r = e.redact('여권번호 M12345678 확인')
    expect(r.redacted).toContain('[REDACTED:passport]')
  })

  it('비밀등급 키워드 마스킹', () => {
    const e = makeEngine()
    const r = e.redact('이 문서는 대외비 입니다. CONFIDENTIAL 표시')
    expect(r.redacted).toContain('[REDACTED:classified]')
    expect(r.hits.filter((h) => h.type === 'classified').length).toBeGreaterThanOrEqual(2)
  })

  it('기밀 키워드 마스킹', () => {
    const e = makeEngine()
    const r = e.redact('절대 기밀 사항')
    expect(r.redacted).toContain('[REDACTED:classified]')
  })

  it('복수 PII 동시 감지', () => {
    const e = makeEngine()
    const r = e.redact('user@test.com / 010-1234-5678 / 901234-1234567')
    expect(r.totalHits).toBeGreaterThanOrEqual(3)
    const types = new Set(r.hits.map((h) => h.type))
    expect(types.has('email')).toBe(true)
    expect(types.has('phone')).toBe(true)
    expect(types.has('rrn')).toBe(true)
  })

  it('totalHits 정확성', () => {
    const e = makeEngine()
    const r = e.redact('a@b.co c@d.co e@f.co')
    expect(r.totalHits).toBe(3)
  })

  it('hits에 원본 값 보존', () => {
    const e = makeEngine()
    const r = e.redact('user@example.com 입니다')
    const hit = r.hits.find((h) => h.type === 'email')
    expect(hit?.value).toBe('user@example.com')
  })

  it('중립 문자열 변경 없음', () => {
    const e = makeEngine()
    const r = e.redact('일반 텍스트 문서입니다')
    expect(r.redacted).toBe('일반 텍스트 문서입니다')
    expect(r.totalHits).toBe(0)
  })

  it('빈 text invalid_input', () => {
    const e = makeEngine()
    expect(() => e.redact('')).toThrow('invalid_input')
  })

  it('C/S등급 차단', () => {
    const e = makeEngine()
    expect(() => e.redact('text', 'C')).toThrow('grade_blocked')
    expect(() => e.redact('text', 'S')).toThrow('grade_blocked')
  })

  it('getAuditLog', () => {
    const e = makeEngine()
    e.redact('user@test.com')
    const log = e.getAuditLog()
    expect(log.some((entry) => entry.event === 'redact_executed')).toBe(true)
  })

  it('대소문자 무관 classified', () => {
    const e = makeEngine()
    const r = e.redact('this is secret data')
    expect(r.redacted).toContain('[REDACTED:classified]')
  })
})
