import { describe, it, expect, beforeEach } from 'vitest'
import { ComplaintPatternPredictorAI } from '../complaint-pattern-predictor-ai'

describe('ComplaintPatternPredictorAI', () => {
  let predictor: ComplaintPatternPredictorAI

  beforeEach(() => {
    predictor = new ComplaintPatternPredictorAI()
  })

  it('N2SF C등급 차단', () => {
    expect(() => predictor.ingest({ complaintId: 'C-X', category: '교통', submittedAt: '2026-01-01', resolutionDays: 5, region: '서울', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF S등급 차단', () => {
    expect(() => predictor.ingest({ complaintId: 'C-Y', category: '행정', submittedAt: '2026-01-01', resolutionDays: 3, region: '부산', grade: 'S' })).toThrow('BLOCKED')
  })

  it('데이터 없으면 기본값 반환', () => {
    const result = predictor.predict('교통')
    expect(result.predictedVolume).toBe(0)
    expect(result.trend).toBe('STABLE')
  })

  it('INCREASING 트렌드 탐지', () => {
    for (let i = 0; i < 3; i++) {
      predictor.ingest({ complaintId: `C-${i}`, category: '환경', submittedAt: '2026-01-01', resolutionDays: 7, region: '서울', grade: 'O' })
    }
    for (let i = 3; i < 8; i++) {
      predictor.ingest({ complaintId: `C-${i}`, category: '환경', submittedAt: '2026-02-01', resolutionDays: 7, region: '서울', grade: 'O' })
    }
    const result = predictor.predict('환경')
    expect(result.trend).toBe('INCREASING')
    expect(result.predictedVolume).toBeGreaterThan(8)
  })

  it('핫 지역 상위 3개 반환', () => {
    for (let i = 0; i < 5; i++) {
      predictor.ingest({ complaintId: `C-${i}`, category: '복지', submittedAt: '2026-01-01', resolutionDays: 5, region: '서울', grade: 'O' })
    }
    predictor.ingest({ complaintId: 'C-5', category: '복지', submittedAt: '2026-01-01', resolutionDays: 5, region: '부산', grade: 'O' })
    predictor.ingest({ complaintId: 'C-6', category: '복지', submittedAt: '2026-01-01', resolutionDays: 5, region: '인천', grade: 'O' })
    const result = predictor.predict('복지')
    expect(result.hotRegions[0]).toBe('서울')
    expect(result.hotRegions.length).toBeLessThanOrEqual(3)
  })

  it('평균 처리 기간 계산', () => {
    predictor.ingest({ complaintId: 'C-1', category: '행정', submittedAt: '2026-01-01', resolutionDays: 10, region: '서울', grade: 'O' })
    predictor.ingest({ complaintId: 'C-2', category: '행정', submittedAt: '2026-01-01', resolutionDays: 20, region: '부산', grade: 'O' })
    const result = predictor.predict('행정')
    expect(result.avgResolutionDays).toBe(15)
  })

  it('감사 로그 복사본 반환', () => {
    predictor.predict('교통')
    const log = predictor.getAuditLog()
    log.push({ timestamp: '', action: 'injected', category: 'X', detail: {} })
    expect(predictor.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
