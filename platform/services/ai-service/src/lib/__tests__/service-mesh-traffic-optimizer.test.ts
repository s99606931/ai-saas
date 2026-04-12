import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMeshTrafficOptimizer, type ServiceNode, type TrafficMetric } from '../service-mesh-traffic-optimizer'

describe('ServiceMeshTrafficOptimizer', () => {
  let optimizer: ServiceMeshTrafficOptimizer

  const node: ServiceNode = {
    nodeId: 'SVC001',
    name: '민원 API',
    namespace: 'production',
    currentPolicy: 'ROUND_ROBIN',
  }

  const makeMetric = (requests: number, errors: number, latency: number): TrafficMetric => ({
    nodeId: 'SVC001',
    windowStart: Date.now(),
    requestCount: requests,
    errorCount: errors,
    avgLatencyMs: latency,
    p99LatencyMs: latency * 2,
  })

  beforeEach(() => {
    optimizer = new ServiceMeshTrafficOptimizer()
    optimizer.registerNode(node)
  })

  it('노드 등록 감사 로그', () => {
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'node.register')).toBe(true)
  })

  it('메트릭 없으면 현재 정책 유지', () => {
    const result = optimizer.optimize('SVC001')
    expect(result.circuitState).toBe('CLOSED')
    expect(result.recommendedPolicy).toBe('ROUND_ROBIN')
  })

  it('에러율 50% 이상 → CIRCUIT OPEN', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(100, 60, 100))
    const result = optimizer.optimize('SVC001')
    expect(result.circuitState).toBe('OPEN')
    expect(result.retryBudget).toBe(0)
  })

  it('에러율 20~50% → HALF_OPEN', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(100, 25, 100))
    const result = optimizer.optimize('SVC001')
    expect(result.circuitState).toBe('HALF_OPEN')
  })

  it('고지연 → LEAST_REQUEST 권고', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(100, 2, 600))
    const result = optimizer.optimize('SVC001')
    expect(result.recommendedPolicy).toBe('LEAST_REQUEST')
  })

  it('미등록 노드 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('미등록 노드 메트릭 기록 에러', () => {
    expect(() => optimizer.recordMetric({ ...makeMetric(10, 0, 50), nodeId: 'UNKNOWN' })).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.recordMetric(makeMetric(100, 5, 100))
    optimizer.optimize('SVC001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'traffic.optimize')).toBe(true)
  })
})
