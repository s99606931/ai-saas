import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceAvailabilityPredictorAI } from '../service-availability-predictor-ai'

describe('ServiceAvailabilityPredictorAI', () => {
  let ai: ServiceAvailabilityPredictorAI

  beforeEach(() => {
    ai = new ServiceAvailabilityPredictorAI()
    ai.registerService('svc-1', 'auth-service', 99.5)
  })

  it('서비스 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'service.register')).toBe(true)
  })

  it('데이터 없을 때 예측 가용성 100 반환', () => {
    const pred = ai.predictAvailability('svc-1')
    expect(pred.predictedAvailability).toBe(100)
    expect(pred.atRisk).toBe(false)
  })

  it('가중 이동평균 예측 — 최근 데이터 가중치 높음', () => {
    ai.recordAvailability('svc-1', 99)
    ai.recordAvailability('svc-1', 98)
    ai.recordAvailability('svc-1', 97)
    const pred = ai.predictAvailability('svc-1')
    // 가중치: idx0=1, idx1=2, idx2=3 → (99*1+98*2+97*3)/(1+2+3) = 586/6 ≈ 97.67
    expect(pred.predictedAvailability).toBeCloseTo(97.67, 1)
  })

  it('위험 임계 미달 시 atRisk=true', () => {
    for (let i = 0; i < 5; i++) ai.recordAvailability('svc-1', 95)
    const pred = ai.predictAvailability('svc-1')
    expect(pred.atRisk).toBe(true)
  })

  it('정상 가용성 — atRisk=false', () => {
    for (let i = 0; i < 5; i++) ai.recordAvailability('svc-1', 99.9)
    const pred = ai.predictAvailability('svc-1')
    expect(pred.atRisk).toBe(false)
  })

  it('위험 서비스 경보 반환', () => {
    for (let i = 0; i < 5; i++) ai.recordAvailability('svc-1', 90)
    const alerts = ai.getAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0]?.serviceId).toBe('svc-1')
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordAvailability('svc-1', 99, 'C')).toThrow('BLOCKED')
  })

  it('미등록 서비스 에러', () => {
    expect(() => ai.predictAvailability('unknown')).toThrow()
  })
})
