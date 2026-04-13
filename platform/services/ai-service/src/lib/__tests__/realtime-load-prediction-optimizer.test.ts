// Plan SC: SVC-AI-ADV-R342
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeLoadPredictionOptimizer } from '../realtime-load-prediction-optimizer'

describe('RealtimeLoadPredictionOptimizer', () => {
  let optimizer: RealtimeLoadPredictionOptimizer

  beforeEach(() => {
    optimizer = new RealtimeLoadPredictionOptimizer()
  })

  it('registerService — 감사 로그에 service.register 기록', () => {
    optimizer.registerService('svc-1', 'API Gateway', 80)
    const log = optimizer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('service.register')
    expect(log[0]!.detail).toBe('svc-1')
  })

  it('predictLoad — 단순 이동평균 계산', () => {
    optimizer.registerService('svc-1', 'API Gateway', 80)
    optimizer.recordLoad('svc-1', 60)
    optimizer.recordLoad('svc-1', 70)
    optimizer.recordLoad('svc-1', 80)
    const pred = optimizer.predictLoad('svc-1', 3)
    // (60+70+80)/3 = 70
    expect(pred.predictedLoad).toBe(70)
    expect(pred.samplesUsed).toBe(3)
  })

  it('predictLoad — shouldScaleUp=true when predictedLoad > scaleUpThreshold', () => {
    optimizer.registerService('svc-1', 'API Gateway', 80)
    optimizer.recordLoad('svc-1', 90)
    optimizer.recordLoad('svc-1', 85)
    optimizer.recordLoad('svc-1', 95)
    const pred = optimizer.predictLoad('svc-1', 3)
    // (90+85+95)/3 = 90 > 80
    expect(pred.shouldScaleUp).toBe(true)
  })

  it('predictLoad — shouldScaleUp=false when predictedLoad <= scaleUpThreshold', () => {
    optimizer.registerService('svc-1', 'API Gateway', 80)
    optimizer.recordLoad('svc-1', 50)
    optimizer.recordLoad('svc-1', 60)
    const pred = optimizer.predictLoad('svc-1', 5)
    expect(pred.shouldScaleUp).toBe(false)
  })

  it('getScaleUpRecommendations — 임계 초과 서비스만 반환', () => {
    optimizer.registerService('svc-1', 'API Gateway', 80)
    optimizer.registerService('svc-2', 'DB Server', 90)
    optimizer.recordLoad('svc-1', 95) // 95 > 80 → scale up
    optimizer.recordLoad('svc-2', 70) // 70 < 90 → no scale
    const recs = optimizer.getScaleUpRecommendations()
    expect(recs).toHaveLength(1)
    expect(recs[0]!.serviceId).toBe('svc-1')
  })

  it('recordLoad — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    optimizer.registerService('svc-1', 'API Gateway', 80)
    expect(() => optimizer.recordLoad('svc-1', 70, 'C')).toThrow('BLOCKED')
  })

  it('recordLoad — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    optimizer.registerService('svc-1', 'API Gateway', 80)
    expect(() => optimizer.recordLoad('svc-1', 70, 'S')).toThrow('N2SF N-05')
  })

  it('predictLoad — 히스토리 없을 때 predictedLoad=0, samplesUsed=0', () => {
    optimizer.registerService('svc-1', 'API Gateway', 80)
    const pred = optimizer.predictLoad('svc-1')
    expect(pred.predictedLoad).toBe(0)
    expect(pred.samplesUsed).toBe(0)
    expect(pred.shouldScaleUp).toBe(false)
  })
})
