import { describe, it, expect, beforeEach } from 'vitest'
import { AiDynamicApiRouter, type ServiceEndpoint, type RouteRule } from '../ai-dynamic-api-router'

describe('AiDynamicApiRouter', () => {
  let router: AiDynamicApiRouter

  const ep1: ServiceEndpoint = { endpointId: 'EP1', serviceId: 'SVC1', url: 'http://svc1-a:8080', weight: 50, version: 'v1' }
  const ep2: ServiceEndpoint = { endpointId: 'EP2', serviceId: 'SVC1', url: 'http://svc1-b:8080', weight: 50, version: 'v1' }
  const ep3: ServiceEndpoint = { endpointId: 'EP3', serviceId: 'SVC1', url: 'http://svc1-c:8080', weight: 50, version: 'v1' }

  const roundRobinRule: RouteRule = {
    ruleId: 'R001',
    pathPattern: '/api/v1/*',
    serviceId: 'SVC1',
    strategy: 'ROUND_ROBIN',
    timeoutMs: 5000,
    retryCount: 3,
  }

  const latencyRule: RouteRule = {
    ruleId: 'R002',
    pathPattern: '/api/v2/*',
    serviceId: 'SVC1',
    strategy: 'LATENCY',
    timeoutMs: 3000,
    retryCount: 1,
  }

  beforeEach(() => {
    router = new AiDynamicApiRouter()
    router.registerEndpoint(ep1)
    router.registerEndpoint(ep2)
    router.registerEndpoint(ep3)
    router.registerRule(roundRobinRule)
    router.registerRule(latencyRule)
  })

  it('규칙 등록 감사 로그', () => {
    const log = router.getAuditLog()
    expect(log.some((e) => e.action === 'rule.register')).toBe(true)
  })

  it('ROUND_ROBIN — 엔드포인트 선택', () => {
    const decision = router.route('R001')
    expect(['EP1', 'EP2', 'EP3']).toContain(decision.selectedEndpoint)
  })

  it('LATENCY — 가장 낮은 지연 엔드포인트 선택', () => {
    router.updateHealth({ endpointId: 'EP1', health: 'HEALTHY', latencyMs: 100, errorRate: 0, lastChecked: new Date().toISOString() })
    router.updateHealth({ endpointId: 'EP2', health: 'HEALTHY', latencyMs: 50, errorRate: 0, lastChecked: new Date().toISOString() })
    router.updateHealth({ endpointId: 'EP3', health: 'HEALTHY', latencyMs: 200, errorRate: 0, lastChecked: new Date().toISOString() })
    const decision = router.route('R002')
    expect(decision.selectedEndpoint).toBe('EP2')
  })

  it('UNHEALTHY 엔드포인트 제외', () => {
    router.updateHealth({ endpointId: 'EP1', health: 'UNHEALTHY', latencyMs: 10, errorRate: 1, lastChecked: new Date().toISOString() })
    router.updateHealth({ endpointId: 'EP2', health: 'UNHEALTHY', latencyMs: 10, errorRate: 1, lastChecked: new Date().toISOString() })
    // EP3은 건강함
    const decision = router.route('R001')
    expect(decision.fallbackUsed).toBe(false)
  })

  it('미등록 규칙 에러', () => {
    expect(() => router.route('UNKNOWN')).toThrow()
  })

  it('엔드포인트 없는 서비스 에러', () => {
    router.registerRule({ ruleId: 'R003', pathPattern: '/empty', serviceId: 'EMPTY_SVC', strategy: 'ROUND_ROBIN', timeoutMs: 1000, retryCount: 0 })
    expect(() => router.route('R003')).toThrow()
  })

  it('라우팅 결정 감사 로그', () => {
    router.route('R001')
    const log = router.getAuditLog()
    expect(log.some((e) => e.action === 'route.decision')).toBe(true)
  })
})
