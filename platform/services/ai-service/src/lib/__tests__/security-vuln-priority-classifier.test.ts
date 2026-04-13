import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityVulnPriorityClassifier, type Vulnerability } from '../security-vuln-priority-classifier'

describe('SecurityVulnPriorityClassifier', () => {
  let classifier: SecurityVulnPriorityClassifier

  const criticalVuln: Vulnerability = {
    vulnId: 'CVE-001',
    title: 'SQL 주입 취약점',
    cvssScore: 9.8,
    exploitabilityScore: 3.9,
    isExploitedInWild: true,
    affectedAssetCriticality: 'HIGH',
    patchAvailable: true,
    category: 'INJECTION',
  }

  beforeEach(() => {
    classifier = new SecurityVulnPriorityClassifier()
    classifier.registerVulnerability(criticalVuln)
  })

  it('취약점 등록 감사 로그', () => {
    const log = classifier.getAuditLog()
    expect(log.some((e) => e.action === 'vuln.register')).toBe(true)
  })

  it('고위험 + 실제 악용 중 → CRITICAL', () => {
    const report = classifier.classify()
    const classified = report.classified.find((v) => v.vulnId === 'CVE-001')!
    expect(classified.priorityLevel).toBe('CRITICAL')
    expect(classified.remediationDeadlineDays).toBe(1)
  })

  it('낮은 CVSS + 비악용 → LOW 이하', () => {
    classifier.registerVulnerability({
      ...criticalVuln,
      vulnId: 'CVE-002',
      cvssScore: 2.0,
      exploitabilityScore: 0.5,
      isExploitedInWild: false,
      affectedAssetCriticality: 'LOW',
    })
    const report = classifier.classify()
    const low = report.classified.find((v) => v.vulnId === 'CVE-002')!
    expect(['LOW', 'INFORMATIONAL']).toContain(low.priorityLevel)
  })

  it('패치 있으면 패치 적용 권고', () => {
    const report = classifier.classify()
    const classified = report.classified.find((v) => v.vulnId === 'CVE-001')!
    expect(classified.remediationActions.some((a) => a.includes('패치'))).toBe(true)
  })

  it('INJECTION 카테고리 → 입력 검증 권고', () => {
    const report = classifier.classify()
    const classified = report.classified.find((v) => v.vulnId === 'CVE-001')!
    expect(classified.remediationActions.some((a) => a.includes('입력 검증'))).toBe(true)
  })

  it('criticalCount + highCount 집계', () => {
    const report = classifier.classify()
    expect(report.criticalCount).toBeGreaterThanOrEqual(1)
    expect(report.totalCount).toBeGreaterThanOrEqual(1)
  })

  it('우선순위 내림차순 정렬', () => {
    classifier.registerVulnerability({ ...criticalVuln, vulnId: 'CVE-003', cvssScore: 3.0, isExploitedInWild: false, affectedAssetCriticality: 'LOW', exploitabilityScore: 0.5 })
    const report = classifier.classify()
    expect(report.classified[0]?.priorityScore ?? 0).toBeGreaterThanOrEqual(report.classified[1]?.priorityScore ?? 0)
  })

  it('분류 후 감사 로그', () => {
    classifier.classify()
    const log = classifier.getAuditLog()
    expect(log.some((e) => e.action === 'vuln.classify')).toBe(true)
  })
})
