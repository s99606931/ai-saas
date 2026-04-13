// Plan SC: SVC-AI-ADV-R447
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMeshRoutingOptimizerV2 } from '../service-mesh-routing-optimizer-v2'

describe('ServiceMeshRoutingOptimizerV2', () => {
  let optimizer: ServiceMeshRoutingOptimizerV2

  beforeEach(() => {
    optimizer = new ServiceMeshRoutingOptimizerV2()
  })

  it('addEndpoint — 감사 로그에 endpoint.add 기록', () => {
    optimizer.addEndpoint('ep-1', 'svc-a', 100, 10)
    expect(optimizer.getAuditLog()[0]!.action).toBe('endpoint.add')
  })

  it('getBestEndpoint — score 기준 최적 엔드포인트 선택', () => {
    optimizer.addEndpoint('ep-1', 'svc-a', 200, 10)  // score=0.05
    optimizer.addEndpoint('ep-2', 'svc-a', 50, 10)   // score=0.2 (최고)
    const best = optimizer.getBestEndpoint('svc-a')
    expect(best!.endpointId).toBe('ep-2')
  })

  it('getBestEndpoint — 엔드포인트 없을 때 null', () => {
    expect(optimizer.getBestEndpoint('nonexistent')).toBeNull()
  })

  it('getServiceEndpoints — 서비스별 엔드포인트 목록', () => {
    optimizer.addEndpoint('ep-1', 'svc-a', 100, 5)
    optimizer.addEndpoint('ep-2', 'svc-a', 200, 8)
    optimizer.addEndpoint('ep-3', 'svc-b', 50, 3)
    const endpoints = optimizer.getServiceEndpoints('svc-a')
    expect(endpoints).toHaveLength(2)
  })

  it('getHighLatencyEndpoints — threshold 초과 엔드포인트 반환', () => {
    optimizer.addEndpoint('ep-1', 'svc-a', 500, 10)
    optimizer.addEndpoint('ep-2', 'svc-a', 100, 10)
    const high = optimizer.getHighLatencyEndpoints(300)
    expect(high).toHaveLength(1)
    expect(high[0]!.endpointId).toBe('ep-1')
  })

  it('addEndpoint — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => optimizer.addEndpoint('ep-1', 'svc-a', 100, 10, 'C')).toThrow('BLOCKED')
  })

  it('addEndpoint — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => optimizer.addEndpoint('ep-1', 'svc-a', 100, 10, 'S')).toThrow('N2SF N-05')
  })

  it('getHighLatencyEndpoints — 없을 때 빈 배열', () => {
    optimizer.addEndpoint('ep-1', 'svc-a', 50, 10)
    expect(optimizer.getHighLatencyEndpoints(300)).toHaveLength(0)
  })
})
