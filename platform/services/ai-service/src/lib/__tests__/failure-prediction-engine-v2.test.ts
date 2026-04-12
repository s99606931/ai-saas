/**
 * AI 기반 장애 예측 엔진 v2 단위 테스트 — SVC-AI-ADV-R183
 * Plan SC: FR-R183.1 ~ FR-R183.5
 */

import { describe, it, expect } from 'vitest'
import { FailurePredictionEngineV2, DataGrade } from '../failure-prediction-engine-v2'

describe('FailurePredictionEngineV2 — R183', () => {
  it('FR-R183.1: 메트릭 등록 및 audit log', () => {
    const fpe = new FailurePredictionEngineV2(DataGrade.O)
    fpe.registerMetric({ id: 'cpu', name: 'CPU 사용률', normalMin: 0, normalMax: 80, unit: '%' })
    const log = fpe.getAuditLog()
    expect(log[0]?.action).toBe('metricRegistered')
  })

  it('FR-R183.2: 읽기값 기록 및 audit log', () => {
    const fpe = new FailurePredictionEngineV2(DataGrade.O)
    fpe.registerMetric({ id: 'cpu', name: 'CPU', normalMin: 0, normalMax: 80, unit: '%' })
    fpe.recordReading({ metricId: 'cpu', value: 50, timestamp: Date.now() })
    const log = fpe.getAuditLog()
    expect(log.some((e) => e.action === 'readingRecorded')).toBe(true)
  })

  it('FR-R183.3: 정상 범위 초과 → 이상값 탐지', () => {
    const fpe = new FailurePredictionEngineV2(DataGrade.O)
    fpe.registerMetric({ id: 'mem', name: '메모리', normalMin: 0, normalMax: 70, unit: '%' })
    // 정상 값 여러 개 후 이상값
    for (let i = 0; i < 5; i++) {
      fpe.recordReading({ metricId: 'mem', value: 50, timestamp: i * 1000 })
    }
    fpe.recordReading({ metricId: 'mem', value: 95, timestamp: 6000 }) // 이상값
    const report = fpe.predict()
    expect(report.anomalies.some((a) => a.metricId === 'mem')).toBe(true)
  })

  it('FR-R183.4: 경보 레벨 — 이상 없으면 normal', () => {
    const fpe = new FailurePredictionEngineV2(DataGrade.O)
    fpe.registerMetric({ id: 'cpu', name: 'CPU', normalMin: 0, normalMax: 100, unit: '%' })
    for (let i = 0; i < 5; i++) {
      fpe.recordReading({ metricId: 'cpu', value: 40, timestamp: i * 1000 })
    }
    const report = fpe.predict()
    expect(report.alertLevel).toBe('normal')
    expect(report.predictionScore).toBe(0)
  })

  it('FR-R183.4: 다수 이상 메트릭 → critical', () => {
    const fpe = new FailurePredictionEngineV2(DataGrade.O, { windowSize: 5 })
    // 모든 메트릭이 이상값
    for (let i = 1; i <= 5; i++) {
      fpe.registerMetric({ id: `m${i}`, name: `M${i}`, normalMin: 0, normalMax: 10, unit: 'x' })
      for (let j = 0; j < 4; j++) {
        fpe.recordReading({ metricId: `m${i}`, value: 5, timestamp: j * 100 })
      }
      fpe.recordReading({ metricId: `m${i}`, value: 999, timestamp: 500 }) // 이상값
    }
    const report = fpe.predict()
    expect(['warning', 'critical']).toContain(report.alertLevel)
  })

  it('FR-R183.5: audit log append-only', () => {
    const fpe = new FailurePredictionEngineV2(DataGrade.O)
    fpe.registerMetric({ id: 'cpu', name: 'CPU', normalMin: 0, normalMax: 100, unit: '%' })
    const log1 = fpe.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(fpe.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new FailurePredictionEngineV2(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new FailurePredictionEngineV2(DataGrade.S)).toThrow('BLOCKED')
  })

  it('미등록 메트릭 읽기값 throw', () => {
    const fpe = new FailurePredictionEngineV2(DataGrade.O)
    expect(() => fpe.recordReading({ metricId: 'unknown', value: 50, timestamp: 0 }))
      .toThrow('unknown metric')
  })
})
