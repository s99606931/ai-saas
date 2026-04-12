import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataQualityPredictor, type DatasetProfile, type QualityMeasurement } from '../public-data-quality-predictor'

describe('PublicDataQualityPredictor', () => {
  let predictor: PublicDataQualityPredictor

  const profile: DatasetProfile = {
    datasetId: 'DS001',
    name: '공공 민원 데이터셋',
    totalRecords: 10000,
    grade: 'O',
  }

  beforeEach(() => {
    predictor = new PublicDataQualityPredictor()
    predictor.registerDataset(profile)
  })

  it('C등급 데이터셋 등록 차단', () => {
    expect(() => predictor.registerDataset({ ...profile, datasetId: 'DS_C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('S등급 데이터셋 등록 차단', () => {
    expect(() => predictor.registerDataset({ ...profile, datasetId: 'DS_S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('데이터셋 등록 감사 로그', () => {
    const log = predictor.getAuditLog()
    expect(log.some((e) => e.action === 'dataset.register')).toBe(true)
  })

  it('측정 없으면 기본 점수 FAIR', () => {
    const result = predictor.predict('DS001')
    expect(result.level).toBe('GOOD')  // 기본값 70 → FAIR이지만 4차원 평균 70 → FAIR
  })

  it('높은 점수 → EXCELLENT', () => {
    const dims = ['COMPLETENESS', 'ACCURACY', 'CONSISTENCY', 'TIMELINESS'] as const
    dims.forEach((d) => predictor.recordMeasurement({ datasetId: 'DS001', dimension: d, score: 95, measuredAt: new Date().toISOString() }))
    const result = predictor.predict('DS001')
    expect(result.level).toBe('EXCELLENT')
  })

  it('낮은 점수 → POOR + 이슈 식별', () => {
    const dims = ['COMPLETENESS', 'ACCURACY', 'CONSISTENCY', 'TIMELINESS'] as const
    dims.forEach((d) => predictor.recordMeasurement({ datasetId: 'DS001', dimension: d, score: 40, measuredAt: new Date().toISOString() }))
    const result = predictor.predict('DS001')
    expect(result.level).toBe('POOR')
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('score 범위 초과 에러', () => {
    const m: QualityMeasurement = { datasetId: 'DS001', dimension: 'ACCURACY', score: 110, measuredAt: new Date().toISOString() }
    expect(() => predictor.recordMeasurement(m)).toThrow()
  })

  it('미등록 데이터셋 에러', () => {
    expect(() => predictor.predict('UNKNOWN')).toThrow()
  })

  it('예측 후 감사 로그', () => {
    predictor.predict('DS001')
    const log = predictor.getAuditLog()
    expect(log.some((e) => e.action === 'quality.predict')).toBe(true)
  })
})
