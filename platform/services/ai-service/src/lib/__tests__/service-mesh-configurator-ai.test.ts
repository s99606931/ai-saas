import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMeshConfiguratorAi, type MeshServiceConfig } from '../service-mesh-configurator-ai'

describe('ServiceMeshConfiguratorAi', () => {
  let configurator: ServiceMeshConfiguratorAi

  const normalService: MeshServiceConfig = {
    serviceId: 'SVC001',
    name: '민원 API',
    namespace: 'production',
    replicas: 3,
    avgLatencyMs: 100,
    errorRate: 0.01,
    requestsPerSecond: 100,
  }

  beforeEach(() => {
    configurator = new ServiceMeshConfiguratorAi()
    configurator.registerService(normalService)
  })

  it('서비스 등록 감사 로그', () => {
    const log = configurator.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('기본 구성: MTLS_STRICT, ROUND_ROBIN, NONE (에러율 1% 이하)', () => {
    const config = configurator.configure('SVC001')
    expect(config.recommendedMtlsPolicy).toBe('MTLS_STRICT')
    expect(config.recommendedLbPolicy).toBe('ROUND_ROBIN')
    expect(config.recommendedRetryPolicy).toBe('NONE')
  })

  it('에러율 1~5% → CONSERVATIVE 재시도', () => {
    configurator.registerService({ ...normalService, serviceId: 'SVC_CON', errorRate: 0.03 })
    const config = configurator.configure('SVC_CON')
    expect(config.recommendedRetryPolicy).toBe('CONSERVATIVE')
    expect(config.maxRetries).toBe(1)
  })

  it('고지연 서비스 → LEAST_CONN', () => {
    configurator.registerService({ ...normalService, serviceId: 'SVC002', avgLatencyMs: 400 })
    const config = configurator.configure('SVC002')
    expect(config.recommendedLbPolicy).toBe('LEAST_CONN')
  })

  it('고RPS 서비스 → CONSISTENT_HASH', () => {
    configurator.registerService({ ...normalService, serviceId: 'SVC003', requestsPerSecond: 1500 })
    const config = configurator.configure('SVC003')
    expect(config.recommendedLbPolicy).toBe('CONSISTENT_HASH')
  })

  it('높은 에러율 → AGGRESSIVE 재시도', () => {
    configurator.registerService({ ...normalService, serviceId: 'SVC004', errorRate: 0.15 })
    const config = configurator.configure('SVC004')
    expect(config.recommendedRetryPolicy).toBe('AGGRESSIVE')
    expect(config.maxRetries).toBe(5)
  })

  it('public namespace → MTLS_PERMISSIVE', () => {
    configurator.registerService({ ...normalService, serviceId: 'SVC005', namespace: 'public' })
    const config = configurator.configure('SVC005')
    expect(config.recommendedMtlsPolicy).toBe('MTLS_PERMISSIVE')
  })

  it('타임아웃: 평균 지연의 3배', () => {
    const config = configurator.configure('SVC001')
    expect(config.timeoutMs).toBeGreaterThanOrEqual(normalService.avgLatencyMs * 3)
  })

  it('미등록 서비스 에러', () => {
    expect(() => configurator.configure('UNKNOWN')).toThrow()
  })

  it('구성 후 감사 로그', () => {
    configurator.configure('SVC001')
    const log = configurator.getAuditLog()
    expect(log.some((e) => e.action === 'mesh.configure')).toBe(true)
  })
})
