import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceDependencyHealthMonitor } from '../service-dependency-health-monitor'

describe('ServiceDependencyHealthMonitor', () => {
  let monitor: ServiceDependencyHealthMonitor

  beforeEach(() => {
    monitor = new ServiceDependencyHealthMonitor()
    monitor.registerService({ serviceId: 'SVC-1', name: 'API Gateway', dependencies: [], criticality: 'CRITICAL' })
    monitor.registerService({ serviceId: 'SVC-2', name: 'Auth Service', dependencies: ['SVC-1'], criticality: 'HIGH' })
  })

  it('알 수 없는 서비스 상태 업데이트 시 오류', () => {
    expect(() => monitor.updateHealth({ serviceId: 'UNKNOWN', status: 'HEALTHY', responseTimeMs: 100, errorRate: 0, timestamp: Date.now() })).toThrow('Unknown service')
  })

  it('알 수 없는 서비스 분석 시 오류', () => {
    expect(() => monitor.analyze('UNKNOWN')).toThrow('Unknown service')
  })

  it('다운스트림 의존 서비스 탐지', () => {
    const report = monitor.analyze('SVC-1')
    expect(report.affectedDownstream).toContain('SVC-2')
  })

  it('크리티컬 패스 탐지 — 다운스트림에 HIGH 서비스', () => {
    const report = monitor.analyze('SVC-1')
    expect(report.criticalPath).toBe(true)
  })

  it('DOWN 상태 — CRITICAL 리스크', () => {
    monitor.updateHealth({ serviceId: 'SVC-1', status: 'DOWN', responseTimeMs: 0, errorRate: 1, timestamp: Date.now() })
    const report = monitor.analyze('SVC-1')
    expect(report.overallRisk).toBe('CRITICAL')
    expect(report.recommendations.some((r) => r.includes('장애 대응'))).toBe(true)
  })

  it('정상 서비스 — LOW 리스크', () => {
    monitor.registerService({ serviceId: 'SVC-3', name: 'Worker', dependencies: [], criticality: 'LOW' })
    monitor.updateHealth({ serviceId: 'SVC-3', status: 'HEALTHY', responseTimeMs: 100, errorRate: 0, timestamp: Date.now() })
    const report = monitor.analyze('SVC-3')
    expect(report.overallRisk).toBe('LOW')
  })

  it('감사 로그 복사본 반환', () => {
    monitor.analyze('SVC-1')
    const log = monitor.getAuditLog()
    log.push({ timestamp: '', action: 'injected', serviceId: 'X', detail: {} })
    expect(monitor.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
