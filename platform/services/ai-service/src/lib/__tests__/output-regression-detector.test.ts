/**
 * Tests — SVC-AI-ADV-R152 Output Regression Detector
 */

import { describe, it, expect } from 'vitest'
import { OutputRegressionDetector } from '../output-regression-detector'

function makeDetector() {
  let t = 1_700_000_000_000
  return new OutputRegressionDetector({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('OutputRegressionDetector', () => {
  it('완벽 일치 → regression 0', () => {
    const d = makeDetector()
    d.addGolden('c1', 'Q1', 'hello world')
    d.submitCandidate('c1', 'hello world')
    const r = d.evaluate()
    expect(r.regressionCount).toBe(0)
    expect(r.passCount).toBe(1)
    expect(r.shouldBlock).toBe(false)
  })

  it('완전 불일치 → 모두 regression', () => {
    const d = makeDetector()
    d.addGolden('c1', 'Q', 'apple banana cherry')
    d.submitCandidate('c1', 'dog cat fish')
    const r = d.evaluate()
    expect(r.regressionCount).toBe(1)
    expect(r.cases[0]!.similarity).toBe(0)
    expect(r.cases[0]!.reason).toBe('low_similarity')
  })

  it('부분 일치 (일부만 회귀)', () => {
    const d = makeDetector()
    d.addGolden('ok', 'Q', 'hello world foo')
    d.addGolden('bad', 'Q', 'alpha beta gamma')
    d.submitCandidate('ok', 'hello world foo bar')
    d.submitCandidate('bad', 'xxx yyy zzz')
    const r = d.evaluate(0.5)
    expect(r.total).toBe(2)
    expect(r.passCount).toBe(1)
    expect(r.regressionCount).toBe(1)
  })

  it('regressionRate 계산', () => {
    const d = makeDetector()
    d.addGolden('a', 'Q', 'one two')
    d.addGolden('b', 'Q', 'three four')
    d.submitCandidate('a', 'one two')
    d.submitCandidate('b', 'xxx yyy')
    const r = d.evaluate()
    expect(r.regressionRate).toBe(0.5)
  })

  it('shouldBlock: rate > blockThreshold', () => {
    const d = makeDetector()
    d.addGolden('a', 'Q', 'foo')
    d.submitCandidate('a', 'bar')
    const r = d.evaluate(0.7, 0.1)
    expect(r.shouldBlock).toBe(true)
  })

  it('shouldBlock false: rate <= blockThreshold', () => {
    const d = makeDetector()
    for (let i = 0; i < 10; i += 1) {
      d.addGolden(`c${i}`, 'Q', 'same text here')
      d.submitCandidate(`c${i}`, 'same text here')
    }
    const r = d.evaluate(0.7, 0.1)
    expect(r.regressionRate).toBe(0)
    expect(r.shouldBlock).toBe(false)
  })

  it('미제출 케이스는 regressed (reason=missing)', () => {
    const d = makeDetector()
    d.addGolden('c1', 'Q', 'hello')
    const r = d.evaluate()
    expect(r.regressionCount).toBe(1)
    expect(r.cases[0]!.reason).toBe('missing')
    expect(r.cases[0]!.similarity).toBe(0)
  })

  it('reset 후 재사용', () => {
    const d = makeDetector()
    d.addGolden('c1', 'Q', 'x')
    d.reset()
    const r = d.evaluate()
    expect(r.total).toBe(0)
    expect(r.regressionRate).toBe(0)
    d.addGolden('c1', 'Q', 'x')
    d.submitCandidate('c1', 'x')
    const r2 = d.evaluate()
    expect(r2.total).toBe(1)
  })

  it('중복 golden id 거부', () => {
    const d = makeDetector()
    d.addGolden('c1', 'Q', 'x')
    expect(() => d.addGolden('c1', 'Q2', 'y')).toThrow('duplicate_golden')
  })

  it('미등록 golden submit 거부', () => {
    const d = makeDetector()
    expect(() => d.submitCandidate('ghost', 'x')).toThrow('golden_not_found')
  })

  it('빈 입력 거부', () => {
    const d = makeDetector()
    expect(() => d.addGolden('', 'Q', 'x')).toThrow('invalid_input')
    expect(() => d.addGolden('c', '', 'x')).toThrow('invalid_input')
    expect(() => d.addGolden('c', 'Q', '')).toThrow('invalid_input')
  })

  it('잘못된 threshold 거부', () => {
    const d = makeDetector()
    expect(() => d.evaluate(-0.1)).toThrow('invalid_threshold')
    expect(() => d.evaluate(1.1)).toThrow('invalid_threshold')
    expect(() => d.evaluate(0.5, -0.1)).toThrow('invalid_threshold')
  })

  it('C/S등급 차단', () => {
    const d = makeDetector()
    expect(() => d.addGolden('c1', 'Q', 'x', 'C')).toThrow('grade_blocked')
    expect(() => d.addGolden('c1', 'Q', 'x', 'S')).toThrow('grade_blocked')
  })

  it('Jaccard 유사도 정확성', () => {
    const d = makeDetector()
    d.addGolden('c1', 'Q', 'a b c d')
    d.submitCandidate('c1', 'a b c e')
    const r = d.evaluate(0.5)
    // A={a,b,c,d} B={a,b,c,e} inter=3 union=5 → 0.6
    expect(r.cases[0]!.similarity).toBeCloseTo(0.6, 3)
    expect(r.cases[0]!.regressed).toBe(false)
  })

  it('case 정렬: localeCompare', () => {
    const d = makeDetector()
    d.addGolden('z', 'Q', 'x')
    d.addGolden('a', 'Q', 'x')
    d.submitCandidate('z', 'x')
    d.submitCandidate('a', 'x')
    const r = d.evaluate()
    expect(r.cases[0]!.id).toBe('a')
    expect(r.cases[1]!.id).toBe('z')
  })

  it('total=0 regressionRate=0', () => {
    const d = makeDetector()
    const r = d.evaluate()
    expect(r.total).toBe(0)
    expect(r.regressionRate).toBe(0)
    expect(r.shouldBlock).toBe(false)
  })

  it('getAuditLog', () => {
    const d = makeDetector()
    d.addGolden('c1', 'Q', 'x')
    d.submitCandidate('c1', 'x')
    d.evaluate()
    const log = d.getAuditLog()
    expect(log.some((e) => e.event === 'golden_added')).toBe(true)
    expect(log.some((e) => e.event === 'candidate_submitted')).toBe(true)
    expect(log.some((e) => e.event === 'evaluated')).toBe(true)
  })
})
