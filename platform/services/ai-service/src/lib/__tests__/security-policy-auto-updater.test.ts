// Design Ref: §R414 — AI기반 자동 보안 정책 갱신
import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityPolicyAutoUpdater } from '../security-policy-auto-updater'

describe('SecurityPolicyAutoUpdater', () => {
  let updater: SecurityPolicyAutoUpdater

  beforeEach(() => {
    updater = new SecurityPolicyAutoUpdater()
    updater.registerPolicy({ policyId: 'POL-001', name: '접근 제어 정책', affectedComponents: ['auth-service'], lastUpdatedAt: '2026-01-01' })
    updater.registerPolicy({ policyId: 'POL-002', name: '네트워크 방화벽 정책', affectedComponents: ['api-gateway'], lastUpdatedAt: '2026-01-01' })
  })

  it('URGENT: CRITICAL CVE → 즉시 갱신 권고', () => {
    updater.registerCve({ cveId: 'CVE-2026-001', severity: 'CRITICAL', affectedComponents: ['auth-service'], description: '인증 우회 취약점' })
    const report = updater.update()
    expect(report.urgentCount).toBeGreaterThan(0)
    const update = report.policyUpdates.find((p) => p.policyId === 'POL-001')
    expect(update?.priority).toBe('URGENT')
  })

  it('HIGH 우선순위: HIGH+MEDIUM CVE 조합', () => {
    updater.registerCve({ cveId: 'CVE-2026-002', severity: 'HIGH', affectedComponents: ['api-gateway'], description: 'SQL 주입' })
    const report = updater.update()
    const update = report.policyUpdates.find((p) => p.policyId === 'POL-002')
    expect(update?.priority).toBe('HIGH')
  })

  it('autoRemediable: CRITICAL CVE 포함 시 false', () => {
    updater.registerCve({ cveId: 'CVE-2026-003', severity: 'CRITICAL', affectedComponents: ['auth-service'], description: '치명적 취약점' })
    const report = updater.update()
    const update = report.policyUpdates.find((p) => p.policyId === 'POL-001')
    expect(update?.autoRemediable).toBe(false)
  })

  it('연관 CVE 없는 정책은 업데이트 목록 미포함', () => {
    updater.registerCve({ cveId: 'CVE-2026-004', severity: 'LOW', affectedComponents: ['unknown-service'], description: '저위험' })
    const report = updater.update()
    expect(report.policyUpdates).toHaveLength(0)
  })

  it('immediateActions: URGENT 정책에 즉시 조치 포함', () => {
    updater.registerCve({ cveId: 'CVE-2026-005', severity: 'CRITICAL', affectedComponents: ['auth-service'], description: '취약점' })
    const report = updater.update()
    expect(report.immediateActions.some((a) => a.includes('즉시'))).toBe(true)
  })

  it('cveScore 내림차순 정렬', () => {
    updater.registerCve({ cveId: 'CVE-A', severity: 'CRITICAL', affectedComponents: ['auth-service'], description: '' })
    updater.registerCve({ cveId: 'CVE-B', severity: 'HIGH', affectedComponents: ['api-gateway'], description: '' })
    const report = updater.update()
    if (report.policyUpdates.length >= 2) {
      expect(report.policyUpdates[0]!.cveScore).toBeGreaterThanOrEqual(report.policyUpdates[1]!.cveScore)
    }
  })

  it('감사 로그에 policy.update 기록', () => {
    updater.registerCve({ cveId: 'CVE-2026-006', severity: 'MEDIUM', affectedComponents: ['auth-service'], description: '중간 위험' })
    updater.update()
    const logs = updater.getAuditLog()
    expect(logs.some((l) => l.action === 'policy.update')).toBe(true)
  })
})
