// Plan SC: SVC-AI-ADV-R556-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { IntegratedMonitoringAIV2, type MonitoredService, type ServiceMetrics } from '../integrated-monitoring-ai-v2'

describe('IntegratedMonitoringAIV2', () => {
  let monitor: IntegratedMonitoringAIV2

  const service: MonitoredService = { serviceId: 'SVC-1', name: '민원 포털', tier: 'CRITICAL' }

  const healthyMetrics: ServiceMetrics = {
    serviceId: 'SVC-1', timestamp: new Date().toISOString(),
    cpuUsagePct: 40, memoryUsagePct: 50, avgResponseTimeMs: 200,
    errorRatePct: 0.5, availabilityPct: 99.9, activeConnections: 100,
  }

  beforeEach(() => {
    monitor = new IntegratedMonitoringAIV2()
  })

  it('미등록 서비스 헬스 조회 시 오류 발생', () => {
    expect(() => monitor.getServiceHealth('UNKNOWN')).toThrow('Unknown service')
  })

  it('메트릭 없는 서비스 → UNKNOWN 상태', () => {
    monitor.registerService(service)
    const report = monitor.getServiceHealth('SVC-1')
    expect(report.status).toBe('UNKNOWN')
  })

  it('정상 메트릭 → HEALTHY 상태', () => {
    monitor.registerService(service)
    monitor.ingestMetrics(healthyMetrics)
    const report = monitor.getServiceHealth('SVC-1')
    expect(report.status).toBe('HEALTHY')
    expect(report.alerts).toHaveLength(0)
  })

  it('CPU 95% → CRITICAL 상태 + 알림 포함', () => {
    monitor.registerService(service)
    monitor.ingestMetrics({ ...healthyMetrics, cpuUsagePct: 95 })
    const report = monitor.getServiceHealth('SVC-1')
    expect(report.status).toBe('CRITICAL')
    expect(report.alerts.some((a) => a.includes('CPU'))).toBe(true)
  })

  it('오류율 12% → CRITICAL 상태', () => {
    monitor.registerService(service)
    monitor.ingestMetrics({ ...healthyMetrics, errorRatePct: 12 })
    const report = monitor.getServiceHealth('SVC-1')
    expect(report.status).toBe('CRITICAL')
  })

  it('가용성 98% → DEGRADED 상태', () => {
    monitor.registerService(service)
    monitor.ingestMetrics({ ...healthyMetrics, cpuUsagePct: 75, availabilityPct: 98 })
    const report = monitor.getServiceHealth('SVC-1')
    expect(report.status).toBe('DEGRADED')
  })

  it('generateReport: 전체 서비스 요약 반환', () => {
    monitor.registerService(service)
    monitor.registerService({ serviceId: 'SVC-2', name: '인사 시스템', tier: 'STANDARD' })
    monitor.ingestMetrics(healthyMetrics)
    monitor.ingestMetrics({ ...healthyMetrics, serviceId: 'SVC-2', cpuUsagePct: 95 })
    const summary = monitor.generateReport()
    expect(summary.totalServices).toBe(2)
    expect(summary.criticalCount).toBe(1)
    expect(summary.healthyCount).toBe(1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    monitor.registerService(service)
    monitor.ingestMetrics(healthyMetrics)
    monitor.getServiceHealth('SVC-1')
    const log1 = monitor.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = monitor.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
