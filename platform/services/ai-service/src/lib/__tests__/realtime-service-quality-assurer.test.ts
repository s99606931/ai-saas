import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeServiceQualityAssurer } from '../realtime-service-quality-assurer'

describe('RealtimeServiceQualityAssurer', () => {
  let assurer: RealtimeServiceQualityAssurer

  beforeEach(() => {
    assurer = new RealtimeServiceQualityAssurer()
    assurer.registerSLA({ serviceId: 'SVC-1', maxLatencyMs: 500, minSuccessRate: 0.99, maxErrorRate: 0.01, minAvailability: 0.999 })
  })

  it('알 수 없는 서비스 측정값 추가 시 오류', () => {
    expect(() => assurer.ingest({ serviceId: 'UNKNOWN', latencyMs: 100, successRate: 0.99, errorRate: 0.01, requestsPerSec: 10, timestamp: Date.now() })).toThrow('Unknown service')
  })

  it('알 수 없는 서비스 평가 시 오류', () => {
    expect(() => assurer.assess('UNKNOWN')).toThrow('Unknown service')
  })

  it('측정값 없으면 ACCEPTABLE 반환', () => {
    const report = assurer.assess('SVC-1')
    expect(report.qualityLevel).toBe('ACCEPTABLE')
    expect(report.slaStatus).toBe('WITHIN_SLA')
  })

  it('정상 서비스 — EXCELLENT/GOOD', () => {
    assurer.ingest({ serviceId: 'SVC-1', latencyMs: 100, successRate: 0.999, errorRate: 0.001, requestsPerSec: 50, timestamp: Date.now() })
    const report = assurer.assess('SVC-1')
    expect(['EXCELLENT', 'GOOD']).toContain(report.qualityLevel)
    expect(report.slaStatus).toBe('WITHIN_SLA')
  })

  it('레이턴시 초과 — SLA_BREACH', () => {
    assurer.ingest({ serviceId: 'SVC-1', latencyMs: 600, successRate: 0.999, errorRate: 0.001, requestsPerSec: 10, timestamp: Date.now() })
    const report = assurer.assess('SVC-1')
    expect(report.slaStatus).toBe('SLA_BREACH')
    expect(report.breachedSLAs.some((s) => s.includes('레이턴시'))).toBe(true)
  })

  it('성공률 미달 — SLA_BREACH', () => {
    assurer.ingest({ serviceId: 'SVC-1', latencyMs: 100, successRate: 0.9, errorRate: 0.1, requestsPerSec: 10, timestamp: Date.now() })
    const report = assurer.assess('SVC-1')
    expect(report.slaStatus).toBe('SLA_BREACH')
    expect(report.breachedSLAs.some((s) => s.includes('성공률'))).toBe(true)
  })

  it('감사 로그 복사본 반환', () => {
    assurer.assess('SVC-1')
    const log = assurer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', serviceId: 'X', detail: {} })
    expect(assurer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
