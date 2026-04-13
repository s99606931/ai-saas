// Plan SC: SVC-AI-ADV-R444
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeHealthPredictorV2 } from '../realtime-health-predictor-v2'

describe('RealtimeHealthPredictorV2', () => {
  let predictor: RealtimeHealthPredictorV2

  beforeEach(() => {
    predictor = new RealtimeHealthPredictorV2()
  })

  it('registerService — 감사 로그에 service.register 기록', () => {
    predictor.registerService('svc-1', 'API Gateway', 100)
    expect(predictor.getAuditLog()[0]!.action).toBe('service.register')
  })

  it('recordMetrics — 건전성 점수 계산 (cpu=0, mem=0, error=0 → 100)', () => {
    predictor.registerService('svc-1', 'API Gateway', 100)
    const snap = predictor.recordMetrics('svc-1', 0, 0, 0)
    expect(snap.healthScore).toBe(100)
  })

  it('recordMetrics — 건전성 점수 계산 (cpu=100, mem=100, error=100 → 0)', () => {
    predictor.registerService('svc-1', 'API Gateway', 100)
    const snap = predictor.recordMetrics('svc-1', 100, 100, 100)
    expect(snap.healthScore).toBe(0)
  })

  it('recordMetrics — 건전성 점수 floor 0 보장', () => {
    predictor.registerService('svc-1', 'API Gateway', 100)
    const snap = predictor.recordMetrics('svc-1', 200, 200, 200)
    expect(snap.healthScore).toBe(0)
  })

  it('getHealthScore — 측정 없을 때 100 반환', () => {
    predictor.registerService('svc-1', 'API Gateway', 100)
    expect(predictor.getHealthScore('svc-1')).toBe(100)
  })

  it('getAtRiskServices — threshold 미만 서비스 반환', () => {
    predictor.registerService('svc-1', 'API Gateway', 100)
    predictor.registerService('svc-2', 'DB', 100)
    predictor.recordMetrics('svc-1', 80, 80, 80)  // 100 - 24 - 24 - 32 = 20
    predictor.recordMetrics('svc-2', 10, 10, 10)  // 100 - 3 - 3 - 4 = 90
    const atRisk = predictor.getAtRiskServices(50)
    expect(atRisk).toHaveLength(1)
    expect(atRisk[0]!.serviceId).toBe('svc-1')
  })

  it('recordMetrics — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    predictor.registerService('svc-1', 'API Gateway', 100)
    expect(() => predictor.recordMetrics('svc-1', 10, 10, 10, 'C')).toThrow('BLOCKED')
  })

  it('recordMetrics — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    predictor.registerService('svc-1', 'API Gateway', 100)
    expect(() => predictor.recordMetrics('svc-1', 10, 10, 10, 'S')).toThrow('N2SF N-05')
  })
})
