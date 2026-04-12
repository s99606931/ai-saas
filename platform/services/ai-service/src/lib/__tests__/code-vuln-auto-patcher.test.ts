import { describe, it, expect, beforeEach } from 'vitest'
import { CodeVulnAutoPatcher, type CodeVuln } from '../code-vuln-auto-patcher'

describe('CodeVulnAutoPatcher', () => {
  let patcher: CodeVulnAutoPatcher

  const criticalVuln: CodeVuln = {
    vulnId: 'CVE-2024-001',
    cve: 'CVE-2024-001',
    packageName: 'lodash',
    currentVersion: '4.17.15',
    affectedVersionRange: '<4.17.21',
    severity: 'CRITICAL',
    description: 'Prototype pollution',
  }

  const breakingVuln: CodeVuln = {
    vulnId: 'CVE-2024-002',
    packageName: 'express',
    currentVersion: '4.18.0',
    affectedVersionRange: '<5.0.0',
    severity: 'HIGH',
    description: 'Path traversal',
  }

  beforeEach(() => {
    patcher = new CodeVulnAutoPatcher()
    patcher.registerVuln(criticalVuln)
    patcher.registerVuln(breakingVuln)
  })

  it('취약점 등록 감사 로그', () => {
    const log = patcher.getAuditLog()
    expect(log.some((e) => e.action === 'vuln.register')).toBe(true)
  })

  it('동일 메이저 버전 CRITICAL → AUTO 전략', () => {
    const candidate = patcher.suggestPatch('CVE-2024-001', '4.17.21')
    expect(candidate.strategy).toBe('AUTO')
    expect(candidate.breakingChanges).toBe(false)
  })

  it('메이저 버전 변경 → MANUAL 전략', () => {
    const candidate = patcher.suggestPatch('CVE-2024-002', '5.0.0')
    expect(candidate.strategy).toBe('MANUAL')
    expect(candidate.breakingChanges).toBe(true)
  })

  it('AUTO 전략 — APPLIED 반환', () => {
    patcher.suggestPatch('CVE-2024-001', '4.17.21')
    const result = patcher.applyPatch('CVE-2024-001')
    expect(result.status).toBe('APPLIED')
    expect(result.appliedVersion).toBe('4.17.21')
  })

  it('MANUAL 전략 — PENDING 반환', () => {
    patcher.suggestPatch('CVE-2024-002', '5.0.0')
    const result = patcher.applyPatch('CVE-2024-002')
    expect(result.status).toBe('PENDING')
  })

  it('패치 후보 없으면 에러', () => {
    expect(() => patcher.applyPatch('CVE-2024-001')).toThrow('패치 후보 없음')
  })

  it('미등록 취약점 패치 제안 에러', () => {
    expect(() => patcher.suggestPatch('UNKNOWN', '1.0.0')).toThrow()
  })

  it('패치 적용 감사 로그', () => {
    patcher.suggestPatch('CVE-2024-001', '4.17.21')
    patcher.applyPatch('CVE-2024-001')
    const log = patcher.getAuditLog()
    expect(log.some((e) => e.action === 'patch.apply')).toBe(true)
  })
})
