/**
 * Tests — SVC-AI-ADV-R155 Context Budget Optimizer
 */

import { describe, it, expect } from 'vitest'
import { ContextBudgetOptimizer } from '../context-budget-optimizer'

function makeOpt() {
  let t = 1_700_000_000_000
  return new ContextBudgetOptimizer({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('ContextBudgetOptimizer', () => {
  it('예산 충분 → 모두 선택', () => {
    const o = makeOpt()
    o.addItem('a', 'contentA', 10, 5)
    o.addItem('b', 'contentB', 20, 3)
    const r = o.selectWithinBudget(100)
    expect(r.selected).toHaveLength(2)
    expect(r.dropped).toHaveLength(0)
    expect(r.usedTokens).toBe(30)
  })

  it('예산 부족 → priority 순 선택', () => {
    const o = makeOpt()
    o.addItem('low', 'x', 30, 1)
    o.addItem('high', 'y', 30, 10)
    o.addItem('mid', 'z', 30, 5)
    const r = o.selectWithinBudget(60)
    const ids = r.selected.map((s) => s.id)
    expect(ids).toEqual(['high', 'mid'])
    expect(r.dropped).toEqual(['low'])
  })

  it('동점 priority → tokens 작은 것 우선', () => {
    const o = makeOpt()
    o.addItem('big', 'x', 50, 5)
    o.addItem('small', 'y', 20, 5)
    const r = o.selectWithinBudget(30)
    expect(r.selected.map((s) => s.id)).toEqual(['small'])
    expect(r.dropped).toEqual(['big'])
  })

  it('utilization 은 used/budget 로 계산된다', () => {
    const o = makeOpt()
    o.addItem('a', 'x', 40, 1)
    const r = o.selectWithinBudget(100)
    expect(r.utilization).toBe(0.4)
  })

  it('dropped 는 선택되지 않은 id 목록', () => {
    const o = makeOpt()
    o.addItem('keep', 'x', 10, 10)
    o.addItem('drop', 'y', 100, 1)
    const r = o.selectWithinBudget(15)
    expect(r.dropped).toContain('drop')
    expect(r.selected[0]?.id).toBe('keep')
  })

  it('reset 은 아이템을 비운다', () => {
    const o = makeOpt()
    o.addItem('a', 'x', 10, 1)
    o.reset()
    const r = o.selectWithinBudget(100)
    expect(r.selected).toHaveLength(0)
  })

  it('중복 id 는 거부된다', () => {
    const o = makeOpt()
    o.addItem('a', 'x', 10, 1)
    expect(() => o.addItem('a', 'y', 5, 2)).toThrow('duplicate_item')
  })

  it('빈 content 는 거부된다', () => {
    const o = makeOpt()
    expect(() => o.addItem('a', '', 10, 1)).toThrow('invalid_input')
  })

  it('tokens <= 0 은 거부된다', () => {
    const o = makeOpt()
    expect(() => o.addItem('a', 'x', 0, 1)).toThrow('invalid_tokens')
    expect(() => o.addItem('b', 'y', -1, 1)).toThrow('invalid_tokens')
  })

  it('budget <= 0 은 거부된다', () => {
    const o = makeOpt()
    o.addItem('a', 'x', 10, 1)
    expect(() => o.selectWithinBudget(0)).toThrow('invalid_budget')
    expect(() => o.selectWithinBudget(-1)).toThrow('invalid_budget')
  })

  it('C/S 등급은 차단된다', () => {
    const o = makeOpt()
    expect(() => o.addItem('a', 'x', 10, 1, 'C')).toThrow('grade_blocked')
    expect(() => o.addItem('b', 'y', 10, 1, 'S')).toThrow('grade_blocked')
  })

  it('감사 로그는 기록된다', () => {
    const o = makeOpt()
    o.addItem('a', 'x', 10, 1)
    o.selectWithinBudget(100)
    const log = o.getAuditLog()
    expect(log.map((e) => e.event)).toContain('item_added')
    expect(log.map((e) => e.event)).toContain('selected')
  })
})
