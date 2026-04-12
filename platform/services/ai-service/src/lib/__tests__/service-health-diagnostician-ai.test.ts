import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceHealthDiagnosticianAI } from '../service-health-diagnostician-ai'

describe('ServiceHealthDiagnosticianAI', () => {
  let diagnostician: ServiceHealthDiagnosticianAI

  beforeEach(() => {
    diagnostician = new ServiceHealthDiagnosticianAI()
    diagnostician.registerService({ serviceId: 'SVC-1', name: '민원 API', dependencies: ['DB-1'] })
  })

  it('알 수 없는 서비스 진단 시 오류', () => {
    expect(() => diagnostician.diagnose('UNKNOWN')).toThrow('Unknown service')
  })

  it('메트릭 없으면 HEALTHY 반환', () => {
    const report = diagnostician.diagnose('SVC-1')
    expect(report.status).toBe('HEALTHY')
    expect(report.score).toBe(100)
  })

  it('정상 메트릭 — HEALTHY', () => {
    diagnostician.ingestMetric({ serviceId: 'SVC-1', timestamp: '2026-04-12T10:00:00Z', cpuPercent: 30, memoryPercent: 40, errorRatePercent: 0.1, latencyMs: 100, activeConnections: 50 })
    const report = diagnostician.diagnose('SVC-1')
    expect(report.status).toBe('HEALTHY')
    expect(report.issues.length).toBe(0)
  })

  it('CPU 과부하 — 이슈 탐지', () => {
    diagnostician.ingestMetric({ serviceId: 'SVC-1', timestamp: '2026-04-12T10:00:00Z', cpuPercent: 95, memoryPercent: 40, errorRatePercent: 0, latencyMs: 100, activeConnections: 50 })
    const report = diagnostician.diagnose('SVC-1')
    expect(report.issues.some((i) => i.includes('CPU'))).toBe(true)
    expect(report.remediationSteps.length).toBeGreaterThan(0)
  })

  it('에러율 높음 — CRITICAL 이하 상태', () => {
    diagnostician.ingestMetric({ serviceId: 'SVC-1', timestamp: '2026-04-12T10:00:00Z', cpuPercent: 30, memoryPercent: 40, errorRatePercent: 10, latencyMs: 100, activeConnections: 50 })
    const report = diagnostician.diagnose('SVC-1')
    expect(['DEGRADED', 'CRITICAL', 'DOWN']).toContain(report.status)
  })

  it('알 수 없는 서비스 메트릭 주입 시 오류', () => {
    expect(() => diagnostician.ingestMetric({ serviceId: 'UNKNOWN', timestamp: '2026-04-12T10:00:00Z', cpuPercent: 30, memoryPercent: 40, errorRatePercent: 0, latencyMs: 100, activeConnections: 10 })).toThrow('Unknown service')
  })

  it('감사 로그 복사본 반환', () => {
    diagnostician.diagnose('SVC-1')
    const log = diagnostician.getAuditLog()
    log.push({ timestamp: '', action: 'injected', serviceId: 'X', detail: {} })
    expect(diagnostician.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
