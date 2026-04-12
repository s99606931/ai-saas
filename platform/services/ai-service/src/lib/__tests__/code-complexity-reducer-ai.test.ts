import { describe, it, expect, beforeEach } from 'vitest'
import { CodeComplexityReducerAI } from '../code-complexity-reducer-ai'

describe('CodeComplexityReducerAI', () => {
  let ai: CodeComplexityReducerAI

  beforeEach(() => {
    ai = new CodeComplexityReducerAI()
    ai.registerFunction('f1', 'src/api.ts', 'processData', 50)
  })

  it('함수 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'function.register')).toBe(true)
  })

  it('복잡도 점수 계산 — 가중 합산', () => {
    ai.recordComplexity('f1', 5, 3, 4)
    const result = ai.calculateComplexityScore('f1')
    // complexityScore = min(100, 5*10)=50, depthScore = min(100, 3*20)=60, paramScore = min(100, 4*15)=60
    // total = 50*0.5 + 60*0.3 + 60*0.2 = 25+18+12 = 55
    expect(result.complexityScore).toBe(50)
    expect(result.depthScore).toBe(60)
    expect(result.totalScore).toBe(55)
  })

  it('복잡도 점수 상한 100', () => {
    ai.recordComplexity('f1', 20, 10, 10)
    const result = ai.calculateComplexityScore('f1')
    expect(result.complexityScore).toBe(100)
    expect(result.depthScore).toBe(100)
    expect(result.paramScore).toBe(100)
  })

  it('cyclomaticComplexity > 10 시 함수 분리 제안', () => {
    ai.recordComplexity('f1', 11, 2, 3)
    const suggestions = ai.getRefactoringSuggestions('f1')
    expect(suggestions).toContain('함수 분리 검토')
  })

  it('nestingDepth > 4 시 Early return 제안', () => {
    ai.recordComplexity('f1', 5, 5, 3)
    const suggestions = ai.getRefactoringSuggestions('f1')
    expect(suggestions).toContain('Early return 패턴 적용 검토')
  })

  it('lines > 80 시 단일 책임 원칙 제안', () => {
    ai.registerFunction('f2', 'src/long.ts', 'longFunction', 90)
    ai.recordComplexity('f2', 5, 3, 3)
    const suggestions = ai.getRefactoringSuggestions('f2')
    expect(suggestions.some((s) => s.includes('단일 책임'))).toBe(true)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordComplexity('f1', 5, 3, 4, 'C')).toThrow('BLOCKED')
  })

  it('미등록 함수 에러', () => {
    expect(() => ai.calculateComplexityScore('unknown')).toThrow()
  })
})
