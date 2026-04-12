/**
 * Tests — SVC-AI-ADV-R153 Multi-Turn Memory Compactor
 */

import { describe, it, expect } from 'vitest'
import { MultiTurnMemoryCompactor } from '../multi-turn-memory-compactor'

function makeCompactor(keepRecent = 2) {
  let t = 1_700_000_000_000
  return new MultiTurnMemoryCompactor({
    keepRecent,
    now: () => {
      t += 1
      return t
    },
  })
}

describe('MultiTurnMemoryCompactor', () => {
  it('budget 이하이면 압축하지 않는다', () => {
    const c = makeCompactor()
    c.appendTurn('user', 'hello world')
    c.appendTurn('assistant', 'hi there friend')
    const before = c.totalTokens()
    const r = c.compactIfNeeded(100)
    expect(r.compacted).toBe(false)
    expect(r.after).toBe(before)
  })

  it('budget 초과 시 요약 턴이 생성된다', () => {
    const c = makeCompactor()
    for (let i = 0; i < 10; i += 1) {
      c.appendTurn('user', `question number ${i} about topic alpha`)
      c.appendTurn('assistant', `answer number ${i} about topic alpha`)
    }
    const before = c.totalTokens()
    const r = c.compactIfNeeded(30)
    expect(r.compacted).toBe(true)
    expect(r.before).toBe(before)
    expect(r.after).toBeLessThanOrEqual(30)
    const history = c.getCompactedHistory()
    const summary = history.find((h) => h.summary === true)
    expect(summary).toBeDefined()
    expect(summary?.content.startsWith('[SUMMARY:')).toBe(true)
  })

  it('pinned 턴은 항상 보존된다', () => {
    const c = makeCompactor()
    c.appendTurn('system', 'system anchor message', { pinned: true })
    for (let i = 0; i < 8; i += 1) {
      c.appendTurn('user', `user message ${i} with some tokens`)
    }
    c.compactIfNeeded(10)
    const history = c.getCompactedHistory()
    const pinned = history.filter((h) => h.pinned)
    expect(pinned).toHaveLength(1)
    expect(pinned[0]?.content).toBe('system anchor message')
  })

  it('최근 2개의 일반 턴은 보존된다', () => {
    const c = makeCompactor(2)
    for (let i = 0; i < 6; i += 1) {
      c.appendTurn('user', `msg ${i} content here`)
    }
    c.compactIfNeeded(8)
    const history = c.getCompactedHistory()
    const nonSummary = history.filter((h) => !h.summary)
    expect(nonSummary.length).toBeGreaterThanOrEqual(2)
    // 가장 마지막 내용이 보존되는지 확인
    const last = nonSummary[nonSummary.length - 1]
    expect(last?.content).toBe('msg 5 content here')
  })

  it('요약만으로 부족하면 오래된 일반 턴을 삭제한다', () => {
    const c = makeCompactor(1)
    for (let i = 0; i < 12; i += 1) {
      c.appendTurn('user', `very long message number ${i} content`)
    }
    const beforeTotal = c.totalTokens()
    const r = c.compactIfNeeded(8)
    // 삭제가 발생해 크기가 줄어야 함. 최소 보존 턴은 남김.
    expect(r.after).toBeLessThan(beforeTotal)
    const history = c.getCompactedHistory()
    // keepRecent=1 → 최소 1개 이상은 남아야 함
    expect(history.length).toBeGreaterThanOrEqual(1)
  })

  it('reset 은 이력을 비운다', () => {
    const c = makeCompactor()
    c.appendTurn('user', 'hi')
    c.reset()
    expect(c.getCompactedHistory()).toHaveLength(0)
    expect(c.totalTokens()).toBe(0)
  })

  it('빈 content 는 거부된다', () => {
    const c = makeCompactor()
    expect(() => c.appendTurn('user', '')).toThrow('invalid_input')
    expect(() => c.appendTurn('user', '   ')).toThrow('invalid_input')
  })

  it('C/S 등급은 차단된다', () => {
    const c = makeCompactor()
    expect(() => c.appendTurn('user', 'classified', { grade: 'C' })).toThrow('grade_blocked')
    expect(() => c.appendTurn('user', 'secret', { grade: 'S' })).toThrow('grade_blocked')
  })

  it('budget <= 0 은 거부된다', () => {
    const c = makeCompactor()
    c.appendTurn('user', 'hi')
    expect(() => c.compactIfNeeded(0)).toThrow('invalid_budget')
    expect(() => c.compactIfNeeded(-1)).toThrow('invalid_budget')
  })

  it('토큰 수를 명시적으로 제공할 수 있다', () => {
    const c = makeCompactor()
    c.appendTurn('user', 'hello', { tokens: 42 })
    expect(c.totalTokens()).toBe(42)
  })

  it('감사 로그는 주요 이벤트를 기록한다', () => {
    const c = makeCompactor()
    c.appendTurn('user', 'hi')
    c.appendTurn('assistant', 'hello there')
    c.compactIfNeeded(100)
    const log = c.getAuditLog()
    const events = log.map((e) => e.event)
    expect(events).toContain('turn_appended')
    expect(events).toContain('compact_skip')
  })
})
