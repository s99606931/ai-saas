import { describe, it, expect, beforeEach } from 'vitest'
import { OrgChartAnalyzerAi, type OrgUnit } from '../org-chart-analyzer-ai'

describe('OrgChartAnalyzerAi', () => {
  let ai: OrgChartAnalyzerAi

  const ministry: OrgUnit = { unitId: 'U001', name: '행정안전부', level: 'MINISTRY', headCount: 500, budget: 1000000 }
  const dept: OrgUnit = { unitId: 'U002', name: '정보화기획과', level: 'DEPARTMENT', parentId: 'U001', headCount: 50, budget: 100000 }

  beforeEach(() => {
    ai = new OrgChartAnalyzerAi()
    ai.registerUnit(ministry)
    ai.registerUnit(dept)
  })

  it('조직 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'unit.register')).toBe(true)
  })

  it('루트 조직 계층 깊이 0', () => {
    const result = ai.analyze('U001')
    expect(result.hierarchyDepth).toBe(0)
  })

  it('하위 조직 계층 깊이 1', () => {
    const result = ai.analyze('U002')
    expect(result.hierarchyDepth).toBe(1)
  })

  it('직속 하위 조직 수 반영', () => {
    const result = ai.analyze('U001')
    expect(result.spanOfControl).toBe(1)
  })

  it('통제 범위 7 초과 → isOverspanned + 권고사항', () => {
    for (let i = 3; i <= 12; i++) {
      ai.registerUnit({ unitId: `U${i.toString().padStart(3,'0')}`, name: `과${i}`, level: 'DIVISION', parentId: 'U001', headCount: 10, budget: 10000 })
    }
    const result = ai.analyze('U001')
    expect(result.isOverspanned).toBe(true)
    expect(result.recommendations.some((r) => r.includes('통제 범위'))).toBe(true)
  })

  it('headCount 음수 에러', () => {
    expect(() => ai.registerUnit({ ...ministry, unitId: 'U_INVALID', headCount: -1 })).toThrow()
  })

  it('미등록 조직 에러', () => {
    expect(() => ai.analyze('UNKNOWN')).toThrow()
  })

  it('분석 후 감사 로그', () => {
    ai.analyze('U001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'unit.analyze')).toBe(true)
  })
})
