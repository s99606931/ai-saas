/**
 * Tests — SVC-AI-ADV-R156 Response Consistency Checker
 */

import { describe, it, expect } from 'vitest'
import { ResponseConsistencyChecker } from '../response-consistency-checker'

function makeChecker(maxSamples = 10) {
  let t = 1_700_000_000_000
  return new ResponseConsistencyChecker({
    maxSamples,
    now: () => {
      t += 1
      return t
    },
  })
}

describe('ResponseConsistencyChecker', () => {
  it('완전 동일 응답 → score 1', () => {
    const c = makeChecker()
    c.record('Q1', 'hello world')
    c.record('Q1', 'hello world')
    const r = c.check('Q1')
    expect(r.score).toBe(1)
    expect(r.passed).toBe(true)
  })

  it('완전 다른 응답 → score 0', () => {
    const c = makeChecker()
    c.record('Q1', 'alpha beta gamma')
    c.record('Q1', 'xyz uvw tuv')
    const r = c.check('Q1')
    expect(r.score).toBe(0)
    expect(r.passed).toBe(false)
  })

  it('부분 일치 → 0 < score < 1', () => {
    const c = makeChecker()
    c.record('Q1', 'alpha beta gamma')
    c.record('Q1', 'alpha beta delta')
    const r = c.check('Q1')
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(1)
  })

  it('단일 샘플 → score 1 (baseline)', () => {
    const c = makeChecker()
    c.record('Q1', 'only answer')
    const r = c.check('Q1')
    expect(r.score).toBe(1)
    expect(r.sampleCount).toBe(1)
  })

  it('질문 정규화 (대소문자/공백 무시)', () => {
    const c = makeChecker()
    c.record('  Q1  ', 'foo')
    c.record('q1', 'bar')
    const r = c.check('Q1')
    expect(r.sampleCount).toBe(2)
  })

  it('미기록 질문 → not_found', () => {
    const c = makeChecker()
    expect(() => c.check('missing')).toThrow('not_found')
  })

  it('샘플 수 초과 시 FIFO', () => {
    const c = makeChecker(3)
    c.record('Q', 'a')
    c.record('Q', 'b')
    c.record('Q', 'c')
    c.record('Q', 'd')
    const r = c.check('Q')
    expect(r.sampleCount).toBe(3)
  })

  it('generateReport 는 전체 질문 집계', () => {
    const c = makeChecker()
    c.record('Q1', 'same')
    c.record('Q1', 'same')
    c.record('Q2', 'alpha')
    c.record('Q2', 'beta')
    const report = c.generateReport(0.6)
    expect(report.questions).toBe(2)
    expect(report.passedCount).toBe(1)
    expect(report.failedCount).toBe(1)
  })

  it('빈 질문/응답은 거부된다', () => {
    const c = makeChecker()
    expect(() => c.record('', 'a')).toThrow('invalid_input')
    expect(() => c.record('q', '')).toThrow('invalid_input')
  })

  it('C/S 등급은 차단된다', () => {
    const c = makeChecker()
    expect(() => c.record('q', 'a', 'C')).toThrow('grade_blocked')
    expect(() => c.record('q', 'a', 'S')).toThrow('grade_blocked')
  })

  it('threshold 범위 위반은 거부된다', () => {
    const c = makeChecker()
    c.record('q', 'a')
    expect(() => c.check('q', -0.1)).toThrow('invalid_threshold')
    expect(() => c.check('q', 1.1)).toThrow('invalid_threshold')
  })

  it('reset 은 샘플을 비운다', () => {
    const c = makeChecker()
    c.record('q', 'a')
    c.reset()
    expect(() => c.check('q')).toThrow('not_found')
  })

  it('감사 로그는 기록된다', () => {
    const c = makeChecker()
    c.record('q', 'a')
    c.check('q')
    const log = c.getAuditLog()
    expect(log.map((e) => e.event)).toContain('recorded')
    expect(log.map((e) => e.event)).toContain('checked')
  })
})
