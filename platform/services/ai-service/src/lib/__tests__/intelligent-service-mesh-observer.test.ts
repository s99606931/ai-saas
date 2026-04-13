import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentServiceMeshObserver, type MeshService, type MeshMetric } from '../intelligent-service-mesh-observer'

describe('IntelligentServiceMeshObserver', () => {
  let observer: IntelligentServiceMeshObserver

  const service: MeshService = {
    serviceId: 'SVC001',
    serviceName: '민원 API',
    namespace: 'production',
    replicas: 3,
  }

  const healthyMetric: MeshMetric = {
    serviceId: 'SVC001',
    timestamp: Date.now(),
    requestRate: 100,
    errorRate: 0.01,
    p99LatencyMs: 200,
    activeConnections: 50,
  }

  beforeEach(() => {
    observer = new IntelligentServiceMeshObserver()
    observer.registerService(service)
  })

  it('서비스 등록 감사 로그', () => {
    const log = observer.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('정상 메트릭 → HEALTHY', () => {
    observer.recordMetric(healthyMetric)
    const obs = observer.observe('SVC001')
    expect(obs.healthStatus).toBe('HEALTHY')
  })

  it('에러율 10% 이상 → CRITICAL', () => {
    observer.recordMetric({ ...healthyMetric, errorRate: 0.15 })
    const obs = observer.observe('SVC001')
    expect(obs.healthStatus).toBe('CRITICAL')
  })

  it('에러율 5%~10% → DEGRADED + 이상 감지', () => {
    observer.recordMetric({ ...healthyMetric, errorRate: 0.07 })
    const obs = observer.observe('SVC001')
    expect(obs.healthStatus).toBe('DEGRADED')
    expect(obs.anomalies.length).toBeGreaterThan(0)
  })

  it('P99 레이턴시 3000ms 이상 → CRITICAL', () => {
    observer.recordMetric({ ...healthyMetric, p99LatencyMs: 3500 })
    const obs = observer.observe('SVC001')
    expect(obs.healthStatus).toBe('CRITICAL')
  })

  it('메트릭 없으면 → UNKNOWN', () => {
    const obs = observer.observe('SVC001')
    expect(obs.healthStatus).toBe('UNKNOWN')
  })

  it('미등록 서비스 에러', () => {
    expect(() => observer.observe('UNKNOWN')).toThrow()
  })

  it('관찰 후 감사 로그', () => {
    observer.recordMetric(healthyMetric)
    observer.observe('SVC001')
    const log = observer.getAuditLog()
    expect(log.some((e) => e.action === 'mesh.observe')).toBe(true)
  })
})
