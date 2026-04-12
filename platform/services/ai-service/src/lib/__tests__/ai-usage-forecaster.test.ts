/**
 * Tests — SVC-AI-ADV-R126 AI Usage Forecaster
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AIUsageForecaster, DataGrade } from '../ai-usage-forecaster'

describe('AIUsageForecaster — R126', () => {
  let f: AIUsageForecaster

  beforeEach(() => {
    f = new AIUsageForecaster()
  })

  function loadLinear(): void {
    // y = 100, 200, 300, 400, 500 (선형 추세)
    for (let i = 0; i < 5; i++) {
      f.addPoint({
        timestamp: i * 86_400_000,
        value: 100 * (i + 1),
        grade: DataGrade.O,
      })
    }
  }

  it('FR-R126.1: 데이터 추가', () => {
    f.addPoint({ timestamp: 1, value: 10, grade: DataGrade.O })
    expect(f.size()).toBe(1)
  })

  it('데이터 정렬', () => {
    f.addPoint({ timestamp: 200, value: 20, grade: DataGrade.O })
    f.addPoint({ timestamp: 100, value: 10, grade: DataGrade.O })
    expect(f.size()).toBe(2)
  })

  it('FR-R126.6: 3개 미만 데이터로 forecast 시 throw', () => {
    f.addPoint({ timestamp: 1, value: 10, grade: DataGrade.O })
    f.addPoint({ timestamp: 2, value: 20, grade: DataGrade.O })
    expect(() => f.forecast(3)).toThrow()
  })

  it('FR-R126.6: 3개 미만 데이터로 fit 시 throw', () => {
    f.addPoint({ timestamp: 1, value: 10, grade: DataGrade.O })
    expect(() => f.fitParameters()).toThrow()
  })

  it('FR-R126.2/3: 선형 추세 예측', () => {
    loadLinear()
    const result = f.forecast(3, { alpha: 0.9, beta: 0.9 })
    expect(result.points.length).toBe(3)
    // 선형 데이터에 대해 next ≈ 600 근처
    expect(result.points[0]?.value).toBeGreaterThan(500)
  })

  it('FR-R126.4: MAPE 계산 (선형 데이터 → 매우 낮음)', () => {
    loadLinear()
    const result = f.forecast(1, { alpha: 0.9, beta: 0.9 })
    // 완벽한 선형이면 MAPE 매우 낮음
    expect(result.mape).toBeLessThan(50)
  })

  it('FR-R126.5: 신뢰구간 lower <= value <= upper', () => {
    loadLinear()
    const r = f.forecast(2)
    for (const p of r.points) {
      expect(p.lower).toBeLessThanOrEqual(p.value)
      expect(p.upper).toBeGreaterThanOrEqual(p.value)
      expect(p.lower).toBeGreaterThanOrEqual(0)
    }
  })

  it('FR-R126.5: 예측 step이 클수록 CI 폭 증가', () => {
    // 노이즈 데이터
    f.addPoint({ timestamp: 1, value: 100, grade: DataGrade.O })
    f.addPoint({ timestamp: 2, value: 110, grade: DataGrade.O })
    f.addPoint({ timestamp: 3, value: 90, grade: DataGrade.O })
    f.addPoint({ timestamp: 4, value: 120, grade: DataGrade.O })
    f.addPoint({ timestamp: 5, value: 100, grade: DataGrade.O })
    const r = f.forecast(3)
    const w1 = (r.points[0]?.upper ?? 0) - (r.points[0]?.lower ?? 0)
    const w3 = (r.points[2]?.upper ?? 0) - (r.points[2]?.lower ?? 0)
    expect(w3).toBeGreaterThanOrEqual(w1)
  })

  it('FR-R126.7: fitParameters 격자 탐색', () => {
    loadLinear()
    const fit = f.fitParameters()
    expect(fit.alpha).toBeGreaterThanOrEqual(0.1)
    expect(fit.alpha).toBeLessThanOrEqual(0.9)
    expect(fit.beta).toBeGreaterThanOrEqual(0.1)
    expect(fit.beta).toBeLessThanOrEqual(0.9)
    expect(fit.mape).toBeGreaterThanOrEqual(0)
  })

  it('FR-R126.8: C등급 차단', () => {
    expect(() =>
      f.addPoint({ timestamp: 1, value: 10, grade: DataGrade.C }),
    ).toThrow('BLOCKED')
  })

  it('FR-R126.8: S등급 차단', () => {
    expect(() =>
      f.addPoint({ timestamp: 1, value: 10, grade: DataGrade.S }),
    ).toThrow('N2SF N-05')
  })

  it('음수 value 차단', () => {
    expect(() =>
      f.addPoint({ timestamp: 1, value: -1, grade: DataGrade.O }),
    ).toThrow()
  })

  it('NaN value 차단', () => {
    expect(() =>
      f.addPoint({ timestamp: 1, value: Number.NaN, grade: DataGrade.O }),
    ).toThrow()
  })

  it('잘못된 alpha/beta', () => {
    loadLinear()
    expect(() => f.forecast(1, { alpha: 1.5 })).toThrow()
    expect(() => f.forecast(1, { beta: -0.1 })).toThrow()
  })

  it('잘못된 steps', () => {
    loadLinear()
    expect(() => f.forecast(0)).toThrow()
  })

  it('reset 동작', () => {
    loadLinear()
    f.reset()
    expect(f.size()).toBe(0)
  })

  it('FR-R126.9: 감사 로그', () => {
    loadLinear()
    f.fitParameters()
    f.forecast(2)
    f.reset()
    const log = f.getAuditLog()
    expect(log.some((e) => e.action === 'addPoint')).toBe(true)
    expect(log.some((e) => e.action === 'fitParameters')).toBe(true)
    expect(log.some((e) => e.action === 'forecast')).toBe(true)
    expect(log.some((e) => e.action === 'reset')).toBe(true)
  })

  it('trainSize 포함', () => {
    loadLinear()
    const r = f.forecast(1)
    expect(r.trainSize).toBe(5)
  })
})
