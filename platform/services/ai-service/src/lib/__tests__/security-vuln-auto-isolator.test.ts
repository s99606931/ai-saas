import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityVulnAutoIsolator, type VulnerabilityAlert } from '../security-vuln-auto-isolator'

describe('SecurityVulnAutoIsolator', () => {
  let isolator: SecurityVulnAutoIsolator

  const baseAlert: VulnerabilityAlert = {
    alertId: 'ALERT001',
    serviceId: 'SVC001',
    cveId: 'CVE-2026-0001',
    severity: 'MEDIUM',
    affectedComponent: 'nginx',
    exploitDetected: false,
    affectedPodCount: 4,
  }

  beforeEach(() => {
    isolator = new SecurityVulnAutoIsolator()
  })

  it('CRITICAL → FULL_ISOLATION, 전체 파드', () => {
    const decision = isolator.isolate({ ...baseAlert, alertId: 'A1', severity: 'CRITICAL' })
    expect(decision.action).toBe('FULL_ISOLATION')
    expect(decision.isolatedPods).toBe(4)
    expect(decision.networkPolicyApplied).toBe(true)
  })

  it('익스플로잇 탐지 → FULL_ISOLATION', () => {
    const decision = isolator.isolate({ ...baseAlert, alertId: 'A2', exploitDetected: true })
    expect(decision.action).toBe('FULL_ISOLATION')
    expect(decision.rollbackRequired).toBe(true)
  })

  it('HIGH → PARTIAL_ISOLATION, 절반 파드', () => {
    const decision = isolator.isolate({ ...baseAlert, alertId: 'A3', severity: 'HIGH' })
    expect(decision.action).toBe('PARTIAL_ISOLATION')
    expect(decision.isolatedPods).toBe(2)
    expect(decision.networkPolicyApplied).toBe(true)
  })

  it('MEDIUM → MONITOR_ONLY', () => {
    const decision = isolator.isolate(baseAlert)
    expect(decision.action).toBe('MONITOR_ONLY')
    expect(decision.isolatedPods).toBe(0)
  })

  it('LOW → NO_ACTION', () => {
    const decision = isolator.isolate({ ...baseAlert, alertId: 'A4', severity: 'LOW' })
    expect(decision.action).toBe('NO_ACTION')
  })

  it('격리 후 감사 로그', () => {
    isolator.isolate(baseAlert)
    const log = isolator.getAuditLog()
    expect(log.some((e) => e.action === 'vuln.isolate')).toBe(true)
  })
})
