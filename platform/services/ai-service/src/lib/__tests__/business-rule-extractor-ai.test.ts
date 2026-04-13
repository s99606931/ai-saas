import { describe, it, expect, beforeEach } from 'vitest'
import { BusinessRuleExtractorAI } from '../business-rule-extractor-ai'

describe('BusinessRuleExtractorAI', () => {
  let ai: BusinessRuleExtractorAI

  beforeEach(() => {
    ai = new BusinessRuleExtractorAI()
    ai.registerRule('r1', 'VIP 할인', 'grade', 'VIP', '10% 할인 적용')
    ai.registerRule('r2', '일반 처리', 'grade', 'NORMAL', '표준 처리')
  })

  it('규칙 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'rule.register')).toBe(true)
  })

  it('조건 매칭 — 해당 규칙 액션 반환', () => {
    const results = ai.evaluate({ grade: 'VIP' })
    const matched = results.filter((r) => r.matched)
    expect(matched.length).toBe(1)
    expect(matched[0]!.action).toBe('10% 할인 적용')
  })

  it('조건 미매칭 — matched=false', () => {
    const results = ai.evaluate({ grade: 'PREMIUM' })
    expect(results.every((r) => !r.matched)).toBe(true)
  })

  it('여러 규칙 동시 평가', () => {
    const results = ai.evaluate({ grade: 'NORMAL' })
    const matched = results.filter((r) => r.matched)
    expect(matched[0]!.ruleName).toBe('일반 처리')
  })

  it('충돌 탐지 — 동일 조건 다른 액션', () => {
    ai.registerRule('r3', 'VIP 무료배송', 'grade', 'VIP', '무료 배송 적용')
    const conflicts = ai.detectConflicts()
    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0]!.conflictingActions.length).toBe(2)
  })

  it('충돌 없을 때 빈 배열', () => {
    const conflicts = ai.detectConflicts()
    expect(conflicts.length).toBe(0)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.registerRule('r4', '테스트', 'key', 'val', 'action', 'C')).toThrow('BLOCKED')
  })

  it('필수값 누락 에러', () => {
    expect(() => ai.registerRule('', '이름', 'key', 'val', 'action')).toThrow()
  })
})
