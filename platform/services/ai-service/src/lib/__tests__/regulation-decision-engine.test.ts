import { describe, it, expect, beforeEach } from 'vitest'
import { RegulationDecisionEngine } from '../regulation-decision-engine'

describe('RegulationDecisionEngine', () => {
  let engine: RegulationDecisionEngine

  beforeEach(() => {
    engine = new RegulationDecisionEngine()
    engine.addRule({
      ruleId: 'R-INCOME',
      title: '저소득 지원 자격',
      category: 'WELFARE',
      conditions: [
        { field: 'income', op: 'LTE', value: 3000000 },
        { field: 'householdSize', op: 'GTE', value: 1 },
      ],
      effect: 'APPROVE',
      priority: 10,
      source: '복지법 제12조',
    })
    engine.addRule({
      ruleId: 'R-AGE',
      title: '연령 제한',
      category: 'WELFARE',
      conditions: [{ field: 'age', op: 'GTE', value: 65 }],
      effect: 'APPROVE',
      priority: 5,
      source: '복지법 제13조',
    })
  })

  it('C등급 평가 차단', () => {
    expect(() =>
      engine.evaluate({ caseId: 'c1', fields: { income: 100 } }, 'op', 'C')
    ).toThrow('BLOCKED')
  })

  it('빈 conditions 거부', () => {
    expect(() =>
      engine.addRule({
        ruleId: 'x',
        title: 'x',
        category: 'x',
        conditions: [],
        effect: 'APPROVE',
        priority: 0,
        source: 'x',
      })
    ).toThrow('conditions')
  })

  it('중복 rule 차단', () => {
    expect(() =>
      engine.addRule({
        ruleId: 'R-INCOME',
        title: 'dup',
        category: 'X',
        conditions: [{ field: 'f', op: 'EQ', value: 1 }],
        effect: 'APPROVE',
        priority: 0,
        source: 's',
      })
    ).toThrow('중복')
  })

  it('음수 priority 차단', () => {
    expect(() =>
      engine.addRule({
        ruleId: 'neg',
        title: 'neg',
        category: 'X',
        conditions: [{ field: 'f', op: 'EQ', value: 1 }],
        effect: 'APPROVE',
        priority: -1,
        source: 's',
      })
    ).toThrow('priority')
  })

  it('매칭 없음 → REVIEW', () => {
    const d = engine.evaluate({ caseId: 'c1', fields: { income: 9999999 } }, 'op-1', 'O')
    expect(d.decision).toBe('REVIEW')
    expect(d.appliedRules.length).toBe(0)
  })

  it('단일 매칭 → APPROVE', () => {
    const d = engine.evaluate(
      { caseId: 'c2', fields: { income: 2000000, householdSize: 2 } },
      'op-1',
      'O'
    )
    expect(d.decision).toBe('APPROVE')
    expect(d.appliedRules).toContain('R-INCOME')
  })

  it('다중 매칭 — 우선순위 높은 규정 적용', () => {
    const d = engine.evaluate(
      { caseId: 'c3', fields: { income: 2000000, householdSize: 2, age: 70 } },
      'op-1',
      'O'
    )
    expect(d.decision).toBe('APPROVE')
    expect(d.appliedRules[0]).toBe('R-INCOME') // priority 10
    expect(d.appliedRules[1]).toBe('R-AGE') // priority 5
  })

  it('APPROVE/DENY 충돌 → REVIEW', () => {
    engine.addRule({
      ruleId: 'R-DENY',
      title: '예외 차단',
      category: 'WELFARE',
      conditions: [{ field: 'income', op: 'LTE', value: 3000000 }],
      effect: 'DENY',
      priority: 10,
      source: '특별법',
    })
    const d = engine.evaluate(
      { caseId: 'c4', fields: { income: 1000000, householdSize: 1 } },
      'op-1',
      'O'
    )
    expect(d.decision).toBe('REVIEW')
    expect(d.conflicts.length).toBeGreaterThan(0)
  })

  it('연산자 다양성 — IN/CONTAINS/NEQ', () => {
    engine.addRule({
      ruleId: 'R-REGION',
      title: '지역 제한',
      category: 'ADMIN',
      conditions: [
        { field: 'region', op: 'IN', value: ['SEOUL', 'BUSAN'] },
        { field: 'note', op: 'CONTAINS', value: '긴급' },
        { field: 'status', op: 'NEQ', value: 'CLOSED' },
      ],
      effect: 'APPROVE',
      priority: 1,
      source: '조례',
    })
    const d = engine.evaluate(
      { caseId: 'c5', fields: { region: 'SEOUL', note: '긴급 요청', status: 'OPEN' } },
      'op-1',
      'O'
    )
    expect(d.decision).toBe('APPROVE')
  })

  it('GT/LT 경계', () => {
    engine.addRule({
      ruleId: 'R-GT',
      title: 'gt',
      category: 'TEST',
      conditions: [{ field: 'score', op: 'GT', value: 50 }],
      effect: 'APPROVE',
      priority: 1,
      source: 's',
    })
    expect(engine.evaluate({ caseId: 'c', fields: { score: 50 } }, 'o', 'O').decision).not.toBe('APPROVE')
    expect(engine.evaluate({ caseId: 'c', fields: { score: 51 } }, 'o', 'O').appliedRules).toContain('R-GT')
  })

  it('listRules — 카테고리 필터', () => {
    const welfare = engine.listRules('WELFARE')
    expect(welfare.length).toBe(2)
    const none = engine.listRules('XYZ')
    expect(none.length).toBe(0)
    const all = engine.listRules()
    expect(all.length).toBe(2)
  })

  it('rationale 출처 포함', () => {
    const d = engine.evaluate(
      { caseId: 'c6', fields: { income: 1000000, householdSize: 1 } },
      'op-1',
      'O'
    )
    expect(d.rationale[0]).toContain('복지법')
    expect(d.rationale[0]).toContain('R-INCOME')
  })

  it('감사 로그 — caseId 마스킹', () => {
    engine.evaluate(
      { caseId: 'sensitive-case-id-1234', fields: { income: 1000000, householdSize: 1 } },
      'officer-abc',
      'O'
    )
    const log = engine.getAuditLog()
    const entry = log.find((e) => e.action === 'case.evaluate')
    expect(entry?.detail.caseIdMasked).not.toBe('sensitive-case-id-1234')
    expect(entry?.callerMasked).toContain('***')
  })
})
