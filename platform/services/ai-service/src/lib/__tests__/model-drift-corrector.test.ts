import { describe, it, expect, beforeEach } from 'vitest'
import { ModelDriftCorrector } from '../model-drift-corrector'

describe('ModelDriftCorrector', () => {
  let corrector: ModelDriftCorrector

  beforeEach(() => {
    corrector = new ModelDriftCorrector()
    corrector.registerModel({
      modelId: 'M-1',
      name: '민원 분류 모델',
      baselineAccuracy: 0.95,
      baselinePrecision: 0.93,
      baselineRecall: 0.91,
      threshold: 0.05,
    })
  })

  it('알 수 없는 모델 메트릭 기록 시 오류', () => {
    expect(() => corrector.recordMetrics({ modelId: 'UNKNOWN', measuredAt: '2026-04-01', accuracy: 0.9, precision: 0.9, recall: 0.9 })).toThrow('Unknown model')
  })

  it('메트릭 없으면 드리프트 없음', () => {
    const report = corrector.analyzeAndCorrect('M-1')
    expect(report.driftDetected).toBe(false)
    expect(report.severity).toBe('NONE')
  })

  it('임계값 내 변화는 드리프트 아님', () => {
    corrector.recordMetrics({ modelId: 'M-1', measuredAt: '2026-04-01', accuracy: 0.93, precision: 0.91, recall: 0.90 })
    const report = corrector.analyzeAndCorrect('M-1')
    expect(report.driftDetected).toBe(false)
  })

  it('CRITICAL 드리프트 — ROLLBACK 권고', () => {
    corrector.recordMetrics({ modelId: 'M-1', measuredAt: '2026-04-01', accuracy: 0.70, precision: 0.68, recall: 0.65 })
    const report = corrector.analyzeAndCorrect('M-1')
    expect(report.driftDetected).toBe(true)
    expect(report.severity).toBe('CRITICAL')
    expect(report.recommendedAction).toBe('ROLLBACK')
    expect(report.correctionApplied).toBe(true)
  })

  it('HIGH 드리프트 — RETRAIN 권고', () => {
    corrector.recordMetrics({ modelId: 'M-1', measuredAt: '2026-04-01', accuracy: 0.84, precision: 0.83, recall: 0.80 })
    const report = corrector.analyzeAndCorrect('M-1')
    expect(report.severity).toBe('HIGH')
    expect(report.recommendedAction).toBe('RETRAIN')
  })

  it('감사 로그 복사본 반환', () => {
    corrector.recordMetrics({ modelId: 'M-1', measuredAt: '2026-04-01', accuracy: 0.94, precision: 0.92, recall: 0.90 })
    corrector.analyzeAndCorrect('M-1')
    const log = corrector.getAuditLog()
    log.push({ timestamp: '', action: 'injected', modelId: 'X', detail: {} })
    expect(corrector.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
