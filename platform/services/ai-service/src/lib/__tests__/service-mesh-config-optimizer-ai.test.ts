// Plan SC: SVC-AI-ADV-R403
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMeshConfigOptimizerAI } from '../service-mesh-config-optimizer-ai'

describe('ServiceMeshConfigOptimizerAI', () => {
  let optimizer: ServiceMeshConfigOptimizerAI

  beforeEach(() => {
    optimizer = new ServiceMeshConfigOptimizerAI()
  })

  it('registerService — 감사 로그에 service.register 기록', () => {
    optimizer.registerService('svc-1', 'API Gateway', 'gateway')
    const log = optimizer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('service.register')
  })

  it('getConfigScore — 모든 권고 기준 충족 시 100점', () => {
    optimizer.registerService('svc-1', 'API Gateway', 'gateway')
    optimizer.recordConfig('svc-1', 3, 2000, true)
    const result = optimizer.getConfigScore('svc-1')
    expect(result.configScore).toBe(100)
    expect(result.recommendations).toHaveLength(0)
  })

  it('getConfigScore — circuitBreaker 비활성 시 -30점', () => {
    optimizer.registerService('svc-1', 'API Gateway', 'gateway')
    optimizer.recordConfig('svc-1', 3, 2000, false)
    const result = optimizer.getConfigScore('svc-1')
    expect(result.configScore).toBe(70)
    expect(result.recommendations).toContain('Circuit Breaker 활성화 권고')
  })

  it('getConfigScore — retryCount 범위 이탈 시 -20점', () => {
    optimizer.registerService('svc-1', 'API Gateway', 'gateway')
    optimizer.recordConfig('svc-1', 10, 2000, true)
    const result = optimizer.getConfigScore('svc-1')
    expect(result.configScore).toBe(80)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('getOptimizationRecommendations — 복합 이탈 시 복수 권고', () => {
    optimizer.registerService('svc-1', 'API Gateway', 'gateway')
    optimizer.recordConfig('svc-1', 1, 100, false)
    const recs = optimizer.getOptimizationRecommendations('svc-1')
    expect(recs.length).toBeGreaterThanOrEqual(3)
  })

  it('recordConfig — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    optimizer.registerService('svc-1', 'API Gateway', 'gateway')
    expect(() => optimizer.recordConfig('svc-1', 3, 2000, true, 'C')).toThrow('BLOCKED')
  })

  it('recordConfig — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    optimizer.registerService('svc-1', 'API Gateway', 'gateway')
    expect(() => optimizer.recordConfig('svc-1', 3, 2000, true, 'S')).toThrow('N2SF N-05')
  })

  it('getConfigScore — 설정 없을 때 에러', () => {
    optimizer.registerService('svc-1', 'API Gateway', 'gateway')
    expect(() => optimizer.getConfigScore('svc-1')).toThrow('설정 없음')
  })
})
