import { describe, it, expect, beforeEach } from 'vitest'
import { EsgMeasurementAi } from '../esg-measurement-ai'
import type { EsgIndicator } from '../esg-measurement-ai'

const GRI_TEMPLATE: EsgIndicator[] = [
  { code: 'GRI-302-1', name: '에너지 소비량', category: 'E', unit: 'GJ', standard: 'GRI' },
  { code: 'GRI-305-1', name: '온실가스 배출량', category: 'E', unit: 'tCO2e', standard: 'GRI' },
  { code: 'GRI-401-1', name: '신규 채용 비율', category: 'S', unit: '%', standard: 'GRI' },
  { code: 'GRI-405-1', name: '이사회 다양성', category: 'G', unit: '%', standard: 'GRI' },
]

describe('EsgMeasurementAi', () => {
  let ai: EsgMeasurementAi

  beforeEach(() => {
    ai = new EsgMeasurementAi()
    ai.registerTemplate('GRI', GRI_TEMPLATE)
  })

  it('N2SF C등급 템플릿 등록 차단', () => {
    expect(() => ai.registerTemplate('GRI', GRI_TEMPLATE, 'C')).toThrow('BLOCKED')
  })

  it('N2SF S등급 템플릿 등록 차단', () => {
    expect(() => ai.registerTemplate('K-ESG', GRI_TEMPLATE, 'S')).toThrow('BLOCKED')
  })

  it('전체 충족 시 A등급', () => {
    const data = new Map([['GRI-302-1', 1000], ['GRI-305-1', 200], ['GRI-401-1', 15], ['GRI-405-1', 40]])
    const result = ai.measure('GRI', '2026-Q1', data)
    expect(result.overallGrade).toBe('A')
    expect(result.coverage).toBe(1)
  })

  it('데이터 없으면 F등급', () => {
    const result = ai.measure('GRI', '2026-Q1', new Map())
    expect(result.overallGrade).toBe('F')
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('카테고리별 점수 계산', () => {
    // E 지표 2개 중 1개만 충족
    const data = new Map([['GRI-302-1', 1000], ['GRI-405-1', 40]])
    const result = ai.measure('GRI', '2026-Q1', data)
    expect(result.eScore).toBeCloseTo(0.5)
    expect(result.gScore).toBe(1)
    expect(result.sScore).toBe(0)
  })

  it('표준 목록 조회', () => {
    ai.registerTemplate('K-ESG', [{ code: 'K-001', name: '탄소', category: 'E', standard: 'K-ESG' }])
    const standards = ai.listStandards()
    expect(standards).toContain('GRI')
    expect(standards).toContain('K-ESG')
  })

  it('감사 로그 복사본 반환', () => {
    ai.measure('GRI', '2026-Q1', new Map())
    const log = ai.getAuditLog()
    log.push({ timestamp: '', action: 'injected', detail: {} })
    expect(ai.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
