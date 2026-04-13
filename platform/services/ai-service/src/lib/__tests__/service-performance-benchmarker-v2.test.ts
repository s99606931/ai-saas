// Plan SC: SVC-AI-ADV-R408
import { describe, it, expect, beforeEach } from 'vitest'
import { ServicePerformanceBenchmarkerV2 } from '../service-performance-benchmarker-v2'

describe('ServicePerformanceBenchmarkerV2', () => {
  let benchmarker: ServicePerformanceBenchmarkerV2

  beforeEach(() => {
    benchmarker = new ServicePerformanceBenchmarkerV2()
  })

  it('registerService — 감사 로그에 service.register 기록', () => {
    benchmarker.registerService('svc-1', 'API Gateway', 200)
    const log = benchmarker.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('service.register')
  })

  it('getBenchmarkResult — 평균 응답시간 계산', () => {
    benchmarker.registerService('svc-1', 'API Gateway', 200)
    benchmarker.recordMeasurement('svc-1', 180)
    benchmarker.recordMeasurement('svc-1', 220)
    const result = benchmarker.getBenchmarkResult('svc-1')
    expect(result.avgResponseMs).toBe(200)
    expect(result.sampleCount).toBe(2)
  })

  it('getBenchmarkResult — 회귀 탐지 (avgResponseMs > baselineMs * 1.2)', () => {
    benchmarker.registerService('svc-1', 'API Gateway', 200)
    benchmarker.recordMeasurement('svc-1', 250) // 250 > 200*1.2=240
    const result = benchmarker.getBenchmarkResult('svc-1')
    expect(result.isRegression).toBe(true)
  })

  it('getBenchmarkResult — 회귀 없음 (avgResponseMs <= baselineMs * 1.2)', () => {
    benchmarker.registerService('svc-1', 'API Gateway', 200)
    benchmarker.recordMeasurement('svc-1', 200)
    const result = benchmarker.getBenchmarkResult('svc-1')
    expect(result.isRegression).toBe(false)
  })

  it('getRegressions — 회귀 서비스만 반환', () => {
    benchmarker.registerService('svc-1', 'API Gateway', 200)
    benchmarker.registerService('svc-2', 'DB', 100)
    benchmarker.recordMeasurement('svc-1', 300) // 회귀
    benchmarker.recordMeasurement('svc-2', 90)  // 정상
    const regressions = benchmarker.getRegressions()
    expect(regressions).toHaveLength(1)
    expect(regressions[0]!.serviceId).toBe('svc-1')
  })

  it('recordMeasurement — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    benchmarker.registerService('svc-1', 'API Gateway', 200)
    expect(() => benchmarker.recordMeasurement('svc-1', 180, 'C')).toThrow('BLOCKED')
  })

  it('recordMeasurement — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    benchmarker.registerService('svc-1', 'API Gateway', 200)
    expect(() => benchmarker.recordMeasurement('svc-1', 180, 'S')).toThrow('N2SF N-05')
  })

  it('getBenchmarkResult — 측정값 없을 때 avgResponseMs=0, isRegression=false', () => {
    benchmarker.registerService('svc-1', 'API Gateway', 200)
    const result = benchmarker.getBenchmarkResult('svc-1')
    expect(result.avgResponseMs).toBe(0)
    expect(result.isRegression).toBe(false)
  })
})
