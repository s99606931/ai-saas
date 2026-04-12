import { describe, it, expect, beforeEach } from 'vitest'
import { ApiUsagePredictor } from '../api-usage-predictor'

describe('ApiUsagePredictor', () => {
  let predictor: ApiUsagePredictor

  beforeEach(() => {
    predictor = new ApiUsagePredictor()
  })

  it('사용량 기록 없을 때 forecast 빈 배열', () => {
    expect(predictor.forecast('API-X')).toEqual([])
  })

  it('시간별 버킷 집계 후 forecast (window=6 이상)', () => {
    // 7시간 데이터 입력
    for (let h = 0; h < 7; h++) {
      predictor.recordCall({ apiId: 'API-1', timestamp: h * 3600000, count: 100 })
    }
    const points = predictor.forecast('API-1')
    expect(points.length).toBeGreaterThan(0)
    expect(points[0]!.predicted).toBe(100)
  })

  it('피크 탐지: Z-score > 2.0인 버킷 반환', () => {
    // 기본 낮은 값 + 하나의 피크
    for (let h = 0; h < 10; h++) {
      predictor.recordCall({ apiId: 'API-2', timestamp: h * 3600000, count: 10 })
    }
    predictor.recordCall({ apiId: 'API-2', timestamp: 10 * 3600000, count: 500 })
    const peaks = predictor.detectPeaks('API-2')
    expect(peaks.length).toBeGreaterThan(0)
    expect(peaks[0]!.zScore).toBeGreaterThan(2.0)
  })

  it('용량 권고: peak * 1.5 올림', () => {
    predictor.recordCall({ apiId: 'API-3', timestamp: 0, count: 100 })
    predictor.recordCall({ apiId: 'API-3', timestamp: 3600000, count: 200 })
    const rec = predictor.recommendCapacity('API-3')
    expect(rec).not.toBeNull()
    expect(rec!.currentPeak).toBe(200)
    expect(rec!.recommendedRps).toBe(300)  // ceil(200 * 1.5)
  })

  it('사용량 없는 API 용량 권고 null', () => {
    expect(predictor.recommendCapacity('API-NONE')).toBeNull()
  })

  it('동일 시간 버킷에 여러 레코드 누적', () => {
    predictor.recordCall({ apiId: 'API-4', timestamp: 100, count: 50 })
    predictor.recordCall({ apiId: 'API-4', timestamp: 200, count: 30 })  // 같은 버킷 (hour 0)
    const rec = predictor.recommendCapacity('API-4')
    expect(rec!.currentPeak).toBe(80)  // 50 + 30
  })

  it('감사 로그 복사본 반환', () => {
    predictor.recordCall({ apiId: 'API-5', timestamp: 0, count: 10 })
    predictor.recommendCapacity('API-5')
    const log = predictor.getAuditLog()
    log.push({ timestamp: '', action: 'injected', apiId: 'X', detail: {} })
    expect(predictor.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
