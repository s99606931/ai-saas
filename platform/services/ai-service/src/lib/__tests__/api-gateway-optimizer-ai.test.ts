import { describe, it, expect, beforeEach } from 'vitest'
import { ApiGatewayOptimizerAI } from '../api-gateway-optimizer-ai'

describe('ApiGatewayOptimizerAI', () => {
  let optimizer: ApiGatewayOptimizerAI

  beforeEach(() => {
    optimizer = new ApiGatewayOptimizerAI()
    optimizer.registerRoute({ routeId: 'R-1', path: '/api/v1/data', method: 'GET', backendUrl: 'http://svc', status: 'ACTIVE', rateLimit: 100, cacheEnabled: false, timeoutMs: 5000 })
  })

  it('알 수 없는 라우트 메트릭 추가 시 오류', () => {
    expect(() => optimizer.ingestMetrics({ routeId: 'UNKNOWN', requestsPerMin: 10, avgLatencyMs: 200, errorRate: 0.01, cacheHitRate: 0, timestamp: Date.now() })).toThrow('Unknown route')
  })

  it('알 수 없는 라우트 최적화 시 오류', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow('Unknown route')
  })

  it('메트릭 없으면 NONE 반환', () => {
    const plan = optimizer.optimize('R-1')
    expect(plan.action).toBe('NONE')
  })

  it('에러율 30% 초과 — CIRCUIT_BREAK', () => {
    optimizer.ingestMetrics({ routeId: 'R-1', requestsPerMin: 50, avgLatencyMs: 200, errorRate: 0.35, cacheHitRate: 0, timestamp: Date.now() })
    const plan = optimizer.optimize('R-1')
    expect(plan.action).toBe('CIRCUIT_BREAK')
  })

  it('요청량 90% 초과 — RATE_LIMIT_ADJUST', () => {
    optimizer.ingestMetrics({ routeId: 'R-1', requestsPerMin: 95, avgLatencyMs: 200, errorRate: 0.01, cacheHitRate: 0, timestamp: Date.now() })
    const plan = optimizer.optimize('R-1')
    expect(plan.action).toBe('RATE_LIMIT_ADJUST')
    expect(plan.suggestedRateLimit).toBeGreaterThan(100)
  })

  it('캐시 미사용 + 높은 레이턴시 — CACHE_ENABLE', () => {
    optimizer.ingestMetrics({ routeId: 'R-1', requestsPerMin: 50, avgLatencyMs: 600, errorRate: 0.01, cacheHitRate: 0, timestamp: Date.now() })
    const plan = optimizer.optimize('R-1')
    expect(plan.action).toBe('CACHE_ENABLE')
  })

  it('DEPRECATED + 트래픽 없음 — ROUTE_REMOVE', () => {
    optimizer.registerRoute({ routeId: 'R-DEP', path: '/old', method: 'GET', backendUrl: 'http://old', status: 'DEPRECATED', rateLimit: 10, cacheEnabled: false, timeoutMs: 3000 })
    optimizer.ingestMetrics({ routeId: 'R-DEP', requestsPerMin: 0, avgLatencyMs: 0, errorRate: 0, cacheHitRate: 0, timestamp: Date.now() })
    const plan = optimizer.optimize('R-DEP')
    expect(plan.action).toBe('ROUTE_REMOVE')
  })

  it('감사 로그 복사본 반환', () => {
    optimizer.optimize('R-1')
    const log = optimizer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', routeId: 'X', detail: {} })
    expect(optimizer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
