import { describe, it, expect, beforeEach } from 'vitest'
import { MicroservicePerformanceProfilerAI } from '../microservice-performance-profiler-ai'

describe('MicroservicePerformanceProfilerAI', () => {
  let ai: MicroservicePerformanceProfilerAI

  beforeEach(() => {
    ai = new MicroservicePerformanceProfilerAI()
    ai.registerService('svc-1', 'auth-service', 200)
  })

  it('서비스 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'service.register')).toBe(true)
  })

  it('지표 기록 및 평균 계산', () => {
    ai.recordMetrics('svc-1', 50, 100, 100)
    ai.recordMetrics('svc-1', 60, 110, 200)
    const stats = ai.getStats('svc-1')
    expect(stats.sampleCount).toBe(2)
    expect(stats.avgResponseTimeMs).toBe(150)
  })

  it('p95/p99 계산', () => {
    for (let i = 0; i < 100; i++) ai.recordMetrics('svc-1', 50, 100, i + 1)
    const stats = ai.getStats('svc-1')
    expect(stats.p95ResponseTimeMs).toBeGreaterThanOrEqual(95)
    expect(stats.p99ResponseTimeMs).toBeGreaterThanOrEqual(99)
  })

  it('SLO 초과 시 병목 탐지', () => {
    for (let i = 0; i < 10; i++) ai.recordMetrics('svc-1', 80, 200, 300)
    const bottlenecks = ai.getBottlenecks()
    expect(bottlenecks.length).toBe(1)
    expect(bottlenecks[0]?.serviceId).toBe('svc-1')
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordMetrics('svc-1', 10, 10, 10, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 차단', () => {
    expect(() => ai.recordMetrics('svc-1', 10, 10, 10, 'S')).toThrow('BLOCKED')
  })

  it('미등록 서비스 에러', () => {
    expect(() => ai.getStats('unknown')).toThrow()
  })

  it('음수 지표 거부', () => {
    expect(() => ai.recordMetrics('svc-1', -1, 10, 10)).toThrow()
  })
})
