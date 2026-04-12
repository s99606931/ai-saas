import { describe, it, expect, beforeEach } from 'vitest'
import { MulticloudNetworkOptimizer, type CloudEndpoint, type NetworkMetric } from '../multicloud-network-optimizer'

describe('MulticloudNetworkOptimizer', () => {
  let optimizer: MulticloudNetworkOptimizer

  const endpoint: CloudEndpoint = {
    endpointId: 'EP001',
    provider: 'AWS',
    region: 'ap-northeast-2',
    currentBandwidthMbps: 1000,
    maxBandwidthMbps: 10000,
  }

  const makeMetric = (latencyMs: number, bandwidthUsedMbps: number, packetLossRate: number): NetworkMetric => ({
    endpointId: 'EP001',
    timestamp: Date.now(),
    latencyMs,
    bandwidthUsedMbps,
    packetLossRate,
  })

  beforeEach(() => {
    optimizer = new MulticloudNetworkOptimizer()
    optimizer.registerEndpoint(endpoint)
  })

  it('엔드포인트 등록 감사 로그', () => {
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'endpoint.register')).toBe(true)
  })

  it('메트릭 없으면 NO_CHANGE', () => {
    const result = optimizer.optimize('EP001')
    expect(result.action).toBe('NO_CHANGE')
  })

  it('패킷 손실 2% 초과 → REROUTE', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(50, 100, 0.03))
    const result = optimizer.optimize('EP001')
    expect(result.action).toBe('REROUTE')
    expect(result.costImpact).toBe('NEUTRAL')
  })

  it('대역폭 85% 초과 → INCREASE_BANDWIDTH', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(50, 900, 0.001))
    // 900/1000 = 90% > 85%
    const result = optimizer.optimize('EP001')
    expect(result.action).toBe('INCREASE_BANDWIDTH')
    expect(result.costImpact).toBe('INCREASE')
    expect(result.recommendedBandwidthMbps).toBeGreaterThan(1000)
  })

  it('고지연 (비온프레미스) → ENABLE_CDN', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(300, 100, 0.001))
    const result = optimizer.optimize('EP001')
    expect(result.action).toBe('ENABLE_CDN')
    expect(result.costImpact).toBe('INCREASE')
  })

  it('온프레미스 고지연 → CDN 미권고', () => {
    const onPremEndpoint: CloudEndpoint = { ...endpoint, endpointId: 'EP_ON', provider: 'ON_PREMISE' }
    optimizer.registerEndpoint(onPremEndpoint)
    for (let i = 0; i < 5; i++) optimizer.recordMetric({ ...makeMetric(300, 100, 0.001), endpointId: 'EP_ON' })
    const result = optimizer.optimize('EP_ON')
    expect(result.action).toBe('NO_CHANGE')
  })

  it('미등록 엔드포인트 최적화 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('미등록 엔드포인트 메트릭 기록 에러', () => {
    expect(() => optimizer.recordMetric({ ...makeMetric(100, 100, 0.001), endpointId: 'UNKNOWN' })).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.recordMetric(makeMetric(50, 100, 0.001))
    optimizer.optimize('EP001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'network.optimize')).toBe(true)
  })
})
