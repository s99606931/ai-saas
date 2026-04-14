// Plan SC: SVC-AI-ADV-R527-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMeshOptimizerV3, type TrafficRoute } from '../service-mesh-optimizer-v3'

describe('ServiceMeshOptimizerV3', () => {
  let optimizer: ServiceMeshOptimizerV3

  const normalRoute: TrafficRoute = {
    routeId: 'ROUTE-1',
    sourceService: 'front',
    targetService: 'api',
    currentPolicy: 'ROUND_ROBIN',
    endpoints: [
      { endpointId: 'EP-1', serviceId: 'api', host: '10.0.0.1', port: 8080, weight: 50, avgLatencyMs: 200, errorRatePct: 1, activeConnections: 10, cpuUsagePct: 30 },
      { endpointId: 'EP-2', serviceId: 'api', host: '10.0.0.2', port: 8080, weight: 50, avgLatencyMs: 400, errorRatePct: 2, activeConnections: 15, cpuUsagePct: 40 },
    ],
  }

  beforeEach(() => {
    optimizer = new ServiceMeshOptimizerV3()
  })

  it('라우트 없을 때 → 최적화 0건', () => {
    const report = optimizer.optimize()
    expect(report.totalRoutes).toBe(0)
    expect(report.optimizations).toHaveLength(0)
  })

  it('LATENCY 타겟 → WEIGHTED 정책 권고', () => {
    optimizer.registerRoute(normalRoute)
    const report = optimizer.optimize('LATENCY')
    const opt = report.optimizations.find((o) => o.routeId === 'ROUTE-1')
    expect(opt?.recommendedPolicy).toBe('WEIGHTED')
  })

  it('오류율 5% 초과 → LEAST_CONN 권고 + highErrorRoutes 포함', () => {
    optimizer.registerRoute({
      ...normalRoute,
      routeId: 'ROUTE-ERR',
      endpoints: [
        { ...normalRoute.endpoints[0]!, endpointId: 'EP-E1', errorRatePct: 8 },
        { ...normalRoute.endpoints[1]!, endpointId: 'EP-E2', errorRatePct: 6 },
      ],
    })
    const report = optimizer.optimize()
    expect(report.highErrorRoutes).toContain('ROUTE-ERR')
    const opt = report.optimizations.find((o) => o.routeId === 'ROUTE-ERR')
    expect(opt?.recommendedPolicy).toBe('LEAST_CONN')
  })

  it('평균 지연 500ms 초과 → highLatencyRoutes 포함', () => {
    optimizer.registerRoute({
      ...normalRoute,
      routeId: 'ROUTE-SLOW',
      endpoints: [
        { ...normalRoute.endpoints[0]!, endpointId: 'EP-S1', avgLatencyMs: 600 },
        { ...normalRoute.endpoints[1]!, endpointId: 'EP-S2', avgLatencyMs: 700 },
      ],
    })
    const report = optimizer.optimize()
    expect(report.highLatencyRoutes).toContain('ROUTE-SLOW')
  })

  it('weightAdjustments: 지연 낮은 엔드포인트에 더 높은 가중치', () => {
    optimizer.registerRoute(normalRoute)
    const report = optimizer.optimize('LATENCY')
    const opt = report.optimizations.find((o) => o.routeId === 'ROUTE-1')
    // EP-1(200ms)이 EP-2(400ms)보다 낮은 지연 → 더 높은 가중치
    const ep1Adj = opt?.weightAdjustments.find((w) => w.endpointId === 'EP-1')
    const ep2Adj = opt?.weightAdjustments.find((w) => w.endpointId === 'EP-2')
    expect((ep1Adj?.recommendedWeight ?? 0)).toBeGreaterThanOrEqual((ep2Adj?.recommendedWeight ?? 0))
  })

  it('THROUGHPUT 타겟 → LEAST_CONN 권고', () => {
    optimizer.registerRoute(normalRoute)
    const report = optimizer.optimize('THROUGHPUT')
    const opt = report.optimizations.find((o) => o.routeId === 'ROUTE-1')
    expect(opt?.recommendedPolicy).toBe('LEAST_CONN')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerRoute(normalRoute)
    optimizer.optimize()
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', routeId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
