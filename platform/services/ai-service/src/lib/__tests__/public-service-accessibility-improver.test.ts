import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceAccessibilityImprover } from '../public-service-accessibility-improver'

describe('PublicServiceAccessibilityImprover', () => {
  let ai: PublicServiceAccessibilityImprover

  beforeEach(() => {
    ai = new PublicServiceAccessibilityImprover()
    ai.registerService('svc1', '민원24 포털')
  })

  it('서비스 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'service.register')).toBe(true)
  })

  it('항목 없을 때 점수 0', () => {
    const result = ai.getAccessibilityScore('svc1')
    expect(result.overallScore).toBe(0)
    expect(result.checkCount).toBe(0)
  })

  it('평균 점수 계산', () => {
    ai.recordAccessibilityCheck('svc1', 'c1', '색상 대비', 80)
    ai.recordAccessibilityCheck('svc1', 'c2', '이미지 대체텍스트', 60)
    const result = ai.getAccessibilityScore('svc1')
    expect(result.overallScore).toBe(70)
  })

  it('critical 위반 탐지 — score < 40', () => {
    ai.recordAccessibilityCheck('svc1', 'c1', '색상 대비', 30)
    const result = ai.getAccessibilityScore('svc1')
    expect(result.violations.some((v) => v.severity === 'critical')).toBe(true)
  })

  it('major 위반 탐지 — score 40~69', () => {
    ai.recordAccessibilityCheck('svc1', 'c1', '링크 텍스트', 55)
    const result = ai.getAccessibilityScore('svc1')
    expect(result.violations.some((v) => v.severity === 'major')).toBe(true)
  })

  it('score >= 90 — 위반 없음', () => {
    ai.recordAccessibilityCheck('svc1', 'c1', '키보드 접근', 95)
    const result = ai.getAccessibilityScore('svc1')
    expect(result.violations.length).toBe(0)
  })

  it('개선 제안 — critical 항목 즉시 수정 필요', () => {
    ai.recordAccessibilityCheck('svc1', 'c1', '색상 대비', 30)
    const suggestions = ai.getImprovementSuggestions('svc1')
    expect(suggestions.some((s) => s.includes('즉시 수정 필요'))).toBe(true)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordAccessibilityCheck('svc1', 'c1', '항목', 80, 'C')).toThrow('BLOCKED')
  })
})
