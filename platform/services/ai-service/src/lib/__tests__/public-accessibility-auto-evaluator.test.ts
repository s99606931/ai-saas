// Plan SC: SVC-AI-ADV-R382
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicAccessibilityAutoEvaluator } from '../public-accessibility-auto-evaluator'

describe('PublicAccessibilityAutoEvaluator', () => {
  let evaluator: PublicAccessibilityAutoEvaluator

  beforeEach(() => {
    evaluator = new PublicAccessibilityAutoEvaluator()
  })

  it('registerService — 감사 로그에 service.register 기록', () => {
    evaluator.registerService('svc-1', '민원포털', 'web')
    const log = evaluator.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('service.register')
  })

  it('getAccessibilityScore — 평균 점수 계산', () => {
    evaluator.registerService('svc-1', '민원포털', 'web')
    evaluator.recordEvaluation('svc-1', 'item-1', true, 90)
    evaluator.recordEvaluation('svc-1', 'item-2', true, 70)
    // (90+70)/2 = 80
    expect(evaluator.getAccessibilityScore('svc-1')).toBe(80)
  })

  it('getIssues — 미통과 항목 심각도 분류', () => {
    evaluator.registerService('svc-1', '민원포털', 'web')
    evaluator.recordEvaluation('svc-1', 'item-1', false, 30)  // critical
    evaluator.recordEvaluation('svc-1', 'item-2', false, 55)  // major
    evaluator.recordEvaluation('svc-1', 'item-3', false, 80)  // minor
    evaluator.recordEvaluation('svc-1', 'item-4', true, 95)   // pass (not in issues)
    const issues = evaluator.getIssues('svc-1')
    expect(issues).toHaveLength(3)
    const severities = issues.map((i) => i.severity)
    expect(severities).toContain('critical')
    expect(severities).toContain('major')
    expect(severities).toContain('minor')
  })

  it('getAccessibilityScore — 평가 없을 때 0', () => {
    evaluator.registerService('svc-1', '민원포털', 'web')
    expect(evaluator.getAccessibilityScore('svc-1')).toBe(0)
  })

  it('recordEvaluation — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    evaluator.registerService('svc-1', '민원포털', 'web')
    expect(() => evaluator.recordEvaluation('svc-1', 'item-1', true, 90, 'C')).toThrow('BLOCKED')
  })

  it('recordEvaluation — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    evaluator.registerService('svc-1', '민원포털', 'web')
    expect(() => evaluator.recordEvaluation('svc-1', 'item-1', true, 90, 'S')).toThrow('N2SF N-05')
  })

  it('getIssues — 통과 항목은 포함하지 않음', () => {
    evaluator.registerService('svc-1', '민원포털', 'web')
    evaluator.recordEvaluation('svc-1', 'item-1', true, 95)
    const issues = evaluator.getIssues('svc-1')
    expect(issues).toHaveLength(0)
  })

  it('recordEvaluation — 동일 itemId 재평가 시 업데이트', () => {
    evaluator.registerService('svc-1', '민원포털', 'web')
    evaluator.recordEvaluation('svc-1', 'item-1', false, 30)
    evaluator.recordEvaluation('svc-1', 'item-1', true, 95)
    expect(evaluator.getAccessibilityScore('svc-1')).toBe(95)
  })
})
