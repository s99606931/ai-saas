// Plan SC: SVC-AI-ADV-R634
import { describe, it, expect, beforeEach } from 'vitest'
import { MunicipalRevenueForecastAI } from '../municipal-revenue-forecast-ai'

describe('MunicipalRevenueForecastAI', () => {
  let ai: MunicipalRevenueForecastAI

  beforeEach(() => {
    ai = new MunicipalRevenueForecastAI()
  })

  it('addRecord — 감사 로그 기록', () => {
    ai.addRecord({ year: 2024, category: 'propertyTax', amount: 1000 })
    expect(ai.getAuditLog()[0]!.action).toBe('record.add')
  })

  it('forecast — 최소 2건 없으면 에러', () => {
    ai.addRecord({ year: 2024, category: 'propertyTax', amount: 1000 })
    expect(() => ai.forecast('propertyTax')).toThrow()
  })

  it('forecast — 증가 추세 시 성장률 양수', () => {
    ai.addRecord({ year: 2023, category: 'propertyTax', amount: 1000 })
    ai.addRecord({ year: 2024, category: 'propertyTax', amount: 1100 })
    ai.addRecord({ year: 2025, category: 'propertyTax', amount: 1200 })
    const f = ai.forecast('propertyTax')
    expect(f.growthRate).toBeGreaterThan(0)
    expect(f.nextYear).toBe(2026)
  })

  it('forecast — 감소 추세 시 성장률 음수', () => {
    ai.addRecord({ year: 2023, category: 'other', amount: 1000 })
    ai.addRecord({ year: 2024, category: 'other', amount: 900 })
    ai.addRecord({ year: 2025, category: 'other', amount: 800 })
    const f = ai.forecast('other')
    expect(f.growthRate).toBeLessThan(0)
  })

  it('forecast — 3년치 데이터는 confidence 1', () => {
    ai.addRecord({ year: 2023, category: 'acquisitionTax', amount: 500 })
    ai.addRecord({ year: 2024, category: 'acquisitionTax', amount: 550 })
    ai.addRecord({ year: 2025, category: 'acquisitionTax', amount: 600 })
    const f = ai.forecast('acquisitionTax')
    expect(f.confidence).toBe(1)
  })

  it('addRecord — S등급 차단', () => {
    expect(() => ai.addRecord({ year: 2024, category: 'propertyTax', amount: 1000 }, 'S')).toThrow(
      'BLOCKED',
    )
  })
})
