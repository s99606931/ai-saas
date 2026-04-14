// Plan SC: SVC-AI-ADV-R520-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { AuditResponseAutomatorV2, type AuditFinding } from '../audit-response-automator-v2'

describe('AuditResponseAutomatorV2', () => {
  let automator: AuditResponseAutomatorV2

  const finding: AuditFinding = {
    findingId: 'FND-1',
    auditType: 'CSAP',
    severity: 'MAJOR',
    category: 'ACCESS_CONTROL',
    description: '접근 권한 과다 부여',
    dueDate: '2026-06-30',
  }

  beforeEach(() => {
    automator = new AuditResponseAutomatorV2()
  })

  it('미등록 지적사항 응답 생성 시 오류 발생', () => {
    expect(() => automator.generateResponse('UNKNOWN')).toThrow('Unknown finding')
  })

  it('MAJOR 지적사항 응답 생성 → IN_PROGRESS, 계획된 조치 포함', () => {
    automator.registerFinding(finding)
    const response = automator.generateResponse('FND-1')
    expect(response.status).toBe('IN_PROGRESS')
    expect(response.plannedActions.length).toBeGreaterThan(0)
  })

  it('CRITICAL 지적사항 → 즉시 조치 계획, 정보보안팀장 배정', () => {
    automator.registerFinding({ ...finding, findingId: 'FND-CRIT', severity: 'CRITICAL' })
    const response = automator.generateResponse('FND-CRIT')
    expect(response.assignedTo).toBe('정보보안팀장')
    expect(response.plannedActions.some((a) => a.includes('즉시'))).toBe(true)
  })

  it('ACCESS_CONTROL 카테고리 → 관련 증거 목록 포함', () => {
    automator.registerFinding(finding)
    const response = automator.generateResponse('FND-1')
    expect(response.evidenceRequired.length).toBeGreaterThan(0)
  })

  it('resolve: 응답 없는 지적사항 → false 반환', () => {
    automator.registerFinding(finding)
    const result = automator.resolve('FND-1')
    expect(result).toBe(false)
  })

  it('resolve: 응답 후 해결 → RESOLVED 상태', () => {
    automator.registerFinding(finding)
    automator.generateResponse('FND-1')
    const result = automator.resolve('FND-1')
    expect(result).toBe(true)
  })

  it('generateReport: CRITICAL 있을 때 complianceScore 감점', () => {
    automator.registerFinding({ ...finding, findingId: 'FND-C1', severity: 'CRITICAL' })
    automator.registerFinding({ ...finding, findingId: 'FND-C2', severity: 'CRITICAL' })
    const report = automator.generateReport('2026-04-13')
    expect(report.criticalCount).toBe(2)
    expect(report.complianceScore).toBeLessThan(100)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    automator.registerFinding(finding)
    automator.generateResponse('FND-1')
    const log1 = automator.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', findingId: 'X', detail: {} })
    const log2 = automator.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
