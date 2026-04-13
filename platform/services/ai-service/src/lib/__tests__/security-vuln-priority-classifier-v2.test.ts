import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityVulnPriorityClassifierV2 } from '../security-vuln-priority-classifier-v2'

describe('SecurityVulnPriorityClassifierV2', () => {
  let classifier: SecurityVulnPriorityClassifierV2

  beforeEach(() => {
    classifier = new SecurityVulnPriorityClassifierV2()
  })

  it('취약점 등록 후 조회 가능', () => {
    const vuln = classifier.registerVuln('CVE-001', 'SQL Injection', 8.5, 'public')
    expect(vuln.vulnId).toBe('CVE-001')
    expect(vuln.title).toBe('SQL Injection')
  })

  it('우선순위 점수: cvssScore*10 + exploitBonus(public=30)', () => {
    classifier.registerVuln('CVE-001', 'SQLi', 8.5, 'public')
    expect(classifier.getPriorityScore('CVE-001')).toBe(115)
  })

  it('우선순위 점수: private exploit bonus=15', () => {
    classifier.registerVuln('CVE-002', 'XSS', 7.0, 'private')
    expect(classifier.getPriorityScore('CVE-002')).toBe(85)
  })

  it('우선순위 점수: none exploit bonus=0', () => {
    classifier.registerVuln('CVE-003', 'Info Disclosure', 5.0, 'none')
    expect(classifier.getPriorityScore('CVE-003')).toBe(50)
  })

  it('critical 등급: 90 이상', () => {
    classifier.registerVuln('CVE-001', 'SQLi', 8.5, 'public')
    expect(classifier.getVulnGrade('CVE-001')).toBe('critical')
  })

  it('high 등급: 70 이상 90 미만', () => {
    classifier.registerVuln('CVE-002', 'XSS', 7.0, 'private')
    expect(classifier.getVulnGrade('CVE-002')).toBe('high')
  })

  it('medium 등급: 50 이상 70 미만', () => {
    classifier.registerVuln('CVE-003', 'InfoDisc', 5.0, 'none')
    expect(classifier.getVulnGrade('CVE-003')).toBe('medium')
  })

  it('low 등급: 50 미만', () => {
    classifier.registerVuln('CVE-004', 'Minor', 3.0, 'none')
    expect(classifier.getVulnGrade('CVE-004')).toBe('low')
  })

  it('getVulnsByGrade: 해당 등급 취약점만 반환', () => {
    classifier.registerVuln('CVE-001', 'SQLi', 8.5, 'public')
    classifier.registerVuln('CVE-004', 'Minor', 3.0, 'none')
    const criticals = classifier.getVulnsByGrade('critical')
    expect(criticals.map((v) => v.vulnId)).toContain('CVE-001')
    expect(criticals.map((v) => v.vulnId)).not.toContain('CVE-004')
  })

  it('C등급 데이터 전송 차단', () => {
    expect(() => classifier.registerVuln('CVE-001', 'SQLi', 8.5, 'public', 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    classifier.registerVuln('CVE-001', 'SQLi', 8.5, 'public')
    const log = classifier.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(1)
  })
})
