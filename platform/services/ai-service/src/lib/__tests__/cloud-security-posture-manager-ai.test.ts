// Design Ref: §R391 — AI기반 클라우드 보안 자세 관리
import { describe, it, expect, beforeEach } from 'vitest'
import { CloudSecurityPostureManagerAi, type CloudResource } from '../cloud-security-posture-manager-ai'

describe('CloudSecurityPostureManagerAi', () => {
  let manager: CloudSecurityPostureManagerAi

  const makeResource = (overrides: Partial<CloudResource> = {}): CloudResource => ({
    resourceId: 'res-001',
    resourceType: 'VM',
    region: 'ap-northeast-2',
    tags: { env: 'prod' },
    isPubliclyAccessible: false,
    encryptionEnabled: true,
    loggingEnabled: true,
    ...overrides,
  })

  beforeEach(() => {
    manager = new CloudSecurityPostureManagerAi()
  })

  it('CRITICAL: 공개 접근 + 암호화 미적용 → CRITICAL 탐지', () => {
    manager.registerResource(makeResource({ resourceId: 'res-crit', isPubliclyAccessible: true, encryptionEnabled: false }))
    const report = manager.assess('account-001')
    expect(report.criticalCount).toBeGreaterThan(0)
    expect(report.findings.some((f) => f.severity === 'CRITICAL')).toBe(true)
  })

  it('HIGH: 공개 접근만 (암호화 있음) → HIGH 탐지', () => {
    manager.registerResource(makeResource({ resourceId: 'res-high', isPubliclyAccessible: true, encryptionEnabled: true }))
    const report = manager.assess('account-002')
    expect(report.highCount).toBeGreaterThan(0)
    expect(report.findings.some((f) => f.severity === 'HIGH' && f.ruleId === 'CSP-002')).toBe(true)
  })

  it('MEDIUM: 로깅 미적용 → MEDIUM 탐지', () => {
    manager.registerResource(makeResource({ resourceId: 'res-med', loggingEnabled: false }))
    const report = manager.assess('account-003')
    expect(report.findings.some((f) => f.severity === 'MEDIUM')).toBe(true)
  })

  it('IAM MFA 미적용 → HIGH 탐지', () => {
    manager.registerResource(makeResource({ resourceId: 'res-iam', resourceType: 'IAM', mfaEnabled: false }))
    const report = manager.assess('account-004')
    expect(report.findings.some((f) => f.ruleId === 'CSP-004' && f.severity === 'HIGH')).toBe(true)
  })

  it('이슈 없음: postureScore 100', () => {
    manager.registerResource(makeResource({ resourceId: 'res-ok' }))
    const report = manager.assess('account-005')
    expect(report.postureScore).toBe(100)
    expect(report.totalFindings).toBe(0)
  })

  it('CRITICAL 발견 시 즉시 조치 계획 포함', () => {
    manager.registerResource(makeResource({ resourceId: 'res-bad', isPubliclyAccessible: true, encryptionEnabled: false }))
    const report = manager.assess('account-006')
    expect(report.remediationPlan.some((p) => p.includes('즉시'))).toBe(true)
  })

  it('감사 로그에 assess 기록', () => {
    manager.registerResource(makeResource())
    manager.assess('account-007')
    const logs = manager.getAuditLog()
    expect(logs.some((l) => l.action === 'posture.assess')).toBe(true)
  })
})
