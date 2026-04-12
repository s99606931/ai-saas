import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceQualityPredictor, type ServiceProfile, type ServiceMetric } from '../public-service-quality-predictor'

describe('PublicServiceQualityPredictor', () => {
  let predictor: PublicServiceQualityPredictor

  const profile: ServiceProfile = {
    serviceId: 'SVC001',
    name: '민원 신청 서비스',
    type: 'ONLINE',
    department: '행정과',
  }

  beforeEach(() => {
    predictor = new PublicServiceQualityPredictor()
    predictor.registerService(profile)
  })

  it('서비스 등록 감사 로그', () => {
    const log = predictor.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('데이터 없으면 FAIR 예측', () => {
    const result = predictor.predict('SVC001')
    expect(result.predictedGrade).toBe('FAIR')
  })

  it('높은 만족도 → EXCELLENT', () => {
    const metrics: ServiceMetric[] = [1, 2, 3].map((m) => ({
      serviceId: 'SVC001', month: m, satisfactionScore: 95, processingDays: 3, complaintCount: 2, usageCount: 100,
    }))
    metrics.forEach((m) => predictor.recordMetric(m))
    const result = predictor.predict('SVC001')
    expect(result.predictedGrade).toBe('EXCELLENT')
  })

  it('낮은 만족도 → POOR', () => {
    const metrics: ServiceMetric[] = [1, 2, 3].map((m) => ({
      serviceId: 'SVC001', month: m, satisfactionScore: 40, processingDays: 3, complaintCount: 2, usageCount: 100,
    }))
    metrics.forEach((m) => predictor.recordMetric(m))
    const result = predictor.predict('SVC001')
    expect(result.predictedGrade).toBe('POOR')
  })

  it('처리기간 초과 위험 요인 탐지', () => {
    predictor.recordMetric({ serviceId: 'SVC001', month: 1, satisfactionScore: 70, processingDays: 20, complaintCount: 5, usageCount: 100 })
    const result = predictor.predict('SVC001')
    expect(result.riskFactors).toContain('처리기간 초과')
  })

  it('월 범위 오류', () => {
    expect(() => predictor.recordMetric({ serviceId: 'SVC001', month: 0, satisfactionScore: 80, processingDays: 5, complaintCount: 0, usageCount: 100 })).toThrow()
  })

  it('미등록 서비스 에러', () => {
    expect(() => predictor.predict('UNKNOWN')).toThrow()
  })

  it('예측 후 감사 로그 기록', () => {
    predictor.recordMetric({ serviceId: 'SVC001', month: 1, satisfactionScore: 80, processingDays: 5, complaintCount: 1, usageCount: 100 })
    predictor.predict('SVC001')
    const log = predictor.getAuditLog()
    expect(log.some((e) => e.action === 'prediction.complete')).toBe(true)
  })
})
