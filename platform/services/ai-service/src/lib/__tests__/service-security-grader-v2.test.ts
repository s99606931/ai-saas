// Plan SC: SVC-AI-ADV-R459-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceSecurityGraderV2, type ServiceSecurityProfile } from '../service-security-grader-v2'

describe('ServiceSecurityGraderV2', () => {
  let grader: ServiceSecurityGraderV2

  const strongProfile: ServiceSecurityProfile = {
    serviceId: 'SVC-1',
    name: '보안 서비스',
    checks: [
      { control: 'AUTH', implemented: true, strength: 'STRONG' },
      { control: 'ENCRYPTION', implemented: true, strength: 'STRONG' },
      { control: 'INPUT_VALIDATION', implemented: true, strength: 'STRONG' },
      { control: 'AUDIT_LOG', implemented: true, strength: 'STRONG' },
      { control: 'ACCESS_CONTROL', implemented: true, strength: 'STRONG' },
      { control: 'NETWORK', implemented: true, strength: 'STRONG' },
      { control: 'PATCH_MANAGEMENT', implemented: true, strength: 'STRONG' },
    ],
    hasKnownVulnerabilities: false,
    lastPenTestDaysAgo: 30,
  }

  beforeEach(() => {
    grader = new ServiceSecurityGraderV2()
    grader.registerProfile(strongProfile)
  })

  it('미등록 서비스 등급 산정 시 오류 발생', () => {
    expect(() => grader.grade('UNKNOWN')).toThrow('Unknown service')
  })

  it('모든 강력 통제 → A등급', () => {
    const report = grader.grade('SVC-1')
    expect(report.grade).toBe('A')
    expect(report.score).toBeGreaterThanOrEqual(90)
  })

  it('AUTH 미구현 → criticalFindings 포함', () => {
    grader.registerProfile({
      ...strongProfile,
      serviceId: 'SVC-NOAUTH',
      checks: [{ control: 'AUTH', implemented: false, strength: 'NONE' }],
    })
    const report = grader.grade('SVC-NOAUTH')
    expect(report.criticalFindings.some((f) => f.includes('AUTH'))).toBe(true)
  })

  it('알려진 취약점 존재 → 점수 20점 감점', () => {
    grader.registerProfile({ ...strongProfile, serviceId: 'SVC-VULN', hasKnownVulnerabilities: true })
    const vulnReport = grader.grade('SVC-VULN')
    const cleanReport = grader.grade('SVC-1')
    expect(cleanReport.score - vulnReport.score).toBe(20)
    expect(vulnReport.criticalFindings.some((f) => f.includes('취약점'))).toBe(true)
  })

  it('통제 미구현 → failedControls 포함', () => {
    grader.registerProfile({
      ...strongProfile,
      serviceId: 'SVC-WEAK',
      checks: [{ control: 'NETWORK', implemented: false, strength: 'NONE' }],
    })
    const report = grader.grade('SVC-WEAK')
    expect(report.failedControls).toContain('NETWORK')
  })

  it('침투 테스트 1년 이상 미실시 → recommendations 포함', () => {
    grader.registerProfile({ ...strongProfile, serviceId: 'SVC-NOPEN', lastPenTestDaysAgo: 400 })
    const report = grader.grade('SVC-NOPEN')
    expect(report.recommendations.some((r) => r.includes('침투 테스트'))).toBe(true)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    grader.grade('SVC-1')
    const log1 = grader.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = grader.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
