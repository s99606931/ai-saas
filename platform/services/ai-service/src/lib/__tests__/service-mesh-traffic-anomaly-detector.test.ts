// Design Ref: §R385 — AI기반 서비스 메시 트래픽 이상 탐지
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMeshTrafficAnomalyDetector } from '../service-mesh-traffic-anomaly-detector'

describe('ServiceMeshTrafficAnomalyDetector', () => {
  let detector: ServiceMeshTrafficAnomalyDetector

  beforeEach(() => {
    detector = new ServiceMeshTrafficAnomalyDetector()
  })

  it('ERROR_SURGE: 에러율 3배 초과 시 CRITICAL 탐지', () => {
    detector.registerBaseline({ serviceId: 'svc-a', routeId: 'rt-1', avgRequestsPerMin: 1000, avgErrorRate: 0.02, avgLatencyMs: 100 })
    const result = detector.detect({ serviceId: 'svc-a', routeId: 'rt-1', requestsPerMin: 1000, errorRate: 0.15, latencyMs: 100, timestamp: Date.now() })
    expect(result.anomalyType).toBe('ERROR_SURGE')
    expect(result.severity).toBe('CRITICAL')
  })

  it('LATENCY_SPIKE: 지연시간 2배 초과 시 HIGH 탐지', () => {
    detector.registerBaseline({ serviceId: 'svc-b', routeId: 'rt-2', avgRequestsPerMin: 500, avgErrorRate: 0.01, avgLatencyMs: 200 })
    const result = detector.detect({ serviceId: 'svc-b', routeId: 'rt-2', requestsPerMin: 500, errorRate: 0.01, latencyMs: 450, timestamp: Date.now() })
    expect(result.anomalyType).toBe('LATENCY_SPIKE')
  })

  it('TRAFFIC_SPIKE: 트래픽 3배 초과 시 HIGH 탐지', () => {
    detector.registerBaseline({ serviceId: 'svc-c', routeId: 'rt-3', avgRequestsPerMin: 300, avgErrorRate: 0.01, avgLatencyMs: 50 })
    const result = detector.detect({ serviceId: 'svc-c', routeId: 'rt-3', requestsPerMin: 1000, errorRate: 0.01, latencyMs: 50, timestamp: Date.now() })
    expect(result.anomalyType).toBe('TRAFFIC_SPIKE')
    expect(result.severity).toBe('HIGH')
  })

  it('TRAFFIC_DROP: 트래픽 80% 이상 감소 시 탐지', () => {
    detector.registerBaseline({ serviceId: 'svc-d', routeId: 'rt-4', avgRequestsPerMin: 1000, avgErrorRate: 0.01, avgLatencyMs: 100 })
    const result = detector.detect({ serviceId: 'svc-d', routeId: 'rt-4', requestsPerMin: 100, errorRate: 0.01, latencyMs: 100, timestamp: Date.now() })
    expect(result.anomalyType).toBe('TRAFFIC_DROP')
  })

  it('NONE: 기준치 내 트래픽은 이상 없음', () => {
    detector.registerBaseline({ serviceId: 'svc-e', routeId: 'rt-5', avgRequestsPerMin: 500, avgErrorRate: 0.01, avgLatencyMs: 150 })
    const result = detector.detect({ serviceId: 'svc-e', routeId: 'rt-5', requestsPerMin: 520, errorRate: 0.01, latencyMs: 160, timestamp: Date.now() })
    expect(result.anomalyType).toBe('NONE')
  })

  it('기준선 없음 → 오류 발생', () => {
    expect(() => detector.detect({ serviceId: 'svc-x', routeId: 'rt-x', requestsPerMin: 100, errorRate: 0.01, latencyMs: 100, timestamp: Date.now() }))
      .toThrow('Baseline not found')
  })

  it('감사 로그에 탐지 기록', () => {
    detector.registerBaseline({ serviceId: 'svc-f', routeId: 'rt-6', avgRequestsPerMin: 200, avgErrorRate: 0.01, avgLatencyMs: 80 })
    detector.detect({ serviceId: 'svc-f', routeId: 'rt-6', requestsPerMin: 200, errorRate: 0.01, latencyMs: 80, timestamp: Date.now() })
    const logs = detector.getAuditLog()
    expect(logs.some((l) => l.action === 'traffic.detect')).toBe(true)
  })
})
