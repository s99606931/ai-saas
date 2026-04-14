import { describe, it, expect, beforeEach } from 'vitest'
import { MicroservicePerformanceProfilerV2 } from '../microservice-performance-profiler-v2'

describe('MicroservicePerformanceProfilerV2', () => {
  let profiler: MicroservicePerformanceProfilerV2

  beforeEach(() => {
    profiler = new MicroservicePerformanceProfilerV2()
  })

  it('서비스 등록 후 조회 가능', () => {
    const svc = profiler.registerService('svc-1', '민원서비스', 'v1.0.0')
    expect(svc.serviceId).toBe('svc-1')
    expect(svc.version).toBe('v1.0.0')
  })

  it('메트릭 없으면 성능 점수 100', () => {
    profiler.registerService('svc-1', '민원서비스', 'v1.0.0')
    expect(profiler.getPerformanceScore('svc-1')).toBe(100)
  })

  it('성능 점수 공식 검증', () => {
    profiler.registerService('svc-1', '민원서비스', 'v1.0.0')
    profiler.recordMetrics('svc-1', 50, 40, 80)
    // score = 100 - 50*0.4 - 40*0.3 - max(0,80-100)*0.1 = 100 - 20 - 12 - 0 = 68
    expect(profiler.getPerformanceScore('svc-1')).toBeCloseTo(68, 1)
  })

  it('성능 점수 최소 0', () => {
    profiler.registerService('svc-1', '민원서비스', 'v1.0.0')
    profiler.recordMetrics('svc-1', 100, 100, 500)
    expect(profiler.getPerformanceScore('svc-1')).toBeGreaterThanOrEqual(0)
  })

  it('getLowPerformanceServices: score < 60', () => {
    profiler.registerService('svc-1', '정상서비스', 'v1.0.0')
    profiler.registerService('svc-2', '저성능서비스', 'v1.0.0')
    profiler.recordMetrics('svc-1', 10, 10, 50)
    profiler.recordMetrics('svc-2', 100, 100, 200)
    const low = profiler.getLowPerformanceServices()
    expect(low.map((s) => s.serviceId)).toContain('svc-2')
    expect(low.map((s) => s.serviceId)).not.toContain('svc-1')
  })

  it('C등급 데이터 전송 차단', () => {
    profiler.registerService('svc-1', '민원서비스', 'v1.0.0')
    expect(() => profiler.recordMetrics('svc-1', 50, 40, 80, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    profiler.registerService('svc-1', '민원서비스', 'v1.0.0')
    expect(() => profiler.recordMetrics('svc-1', 50, 40, 80, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    profiler.registerService('svc-1', '민원서비스', 'v1.0.0')
    profiler.recordMetrics('svc-1', 50, 40, 80)
    const log = profiler.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
