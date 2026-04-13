import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceUsagePredictor, type ServiceUsageHistory } from '../public-service-usage-predictor'

describe('PublicServiceUsagePredictor', () => {
  let predictor: PublicServiceUsagePredictor

  beforeEach(() => {
    predictor = new PublicServiceUsagePredictor()
    predictor.registerService('SVC001')
  })

  it('서비스 등록 감사 로그', () => {
    const log = predictor.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('히스토리 없으면 LOW 신뢰도', () => {
    const prediction = predictor.predict('SVC001', '2026-05')
    expect(prediction.confidenceLevel).toBe('LOW')
    expect(prediction.predictedActiveUsers).toBe(0)
  })

  it('성장 추세 감지 → GROWING', () => {
    const records: ServiceUsageHistory[] = [
      { serviceId: 'SVC001', month: '2026-01', activeUsers: 100, apiCalls: 1000, peakConcurrentUsers: 20 },
      { serviceId: 'SVC001', month: '2026-02', activeUsers: 200, apiCalls: 2000, peakConcurrentUsers: 40 },
    ]
    records.forEach((r) => predictor.recordHistory(r))
    const prediction = predictor.predict('SVC001', '2026-03')
    expect(prediction.trend).toBe('GROWING')
  })

  it('감소 추세 → DECLINING + 권고사항', () => {
    const records: ServiceUsageHistory[] = [
      { serviceId: 'SVC001', month: '2026-01', activeUsers: 500, apiCalls: 5000, peakConcurrentUsers: 100 },
      { serviceId: 'SVC001', month: '2026-02', activeUsers: 100, apiCalls: 1000, peakConcurrentUsers: 20 },
    ]
    records.forEach((r) => predictor.recordHistory(r))
    const prediction = predictor.predict('SVC001', '2026-03')
    expect(prediction.trend).toBe('DECLINING')
    expect(prediction.recommendations.some((r) => r.includes('감소'))).toBe(true)
  })

  it('3개월+ 데이터 → MEDIUM 이상 신뢰도', () => {
    for (let i = 1; i <= 3; i++) {
      predictor.recordHistory({ serviceId: 'SVC001', month: `2026-0${i}`, activeUsers: 100, apiCalls: 1000, peakConcurrentUsers: 20 })
    }
    const prediction = predictor.predict('SVC001', '2026-04')
    expect(['MEDIUM', 'HIGH']).toContain(prediction.confidenceLevel)
  })

  it('미등록 서비스 에러', () => {
    expect(() => predictor.predict('UNKNOWN', '2026-05')).toThrow()
  })

  it('예측 후 감사 로그', () => {
    predictor.predict('SVC001', '2026-05')
    const log = predictor.getAuditLog()
    expect(log.some((e) => e.action === 'usage.predict')).toBe(true)
  })
})
