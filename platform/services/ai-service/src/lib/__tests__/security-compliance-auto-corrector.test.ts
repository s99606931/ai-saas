import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityComplianceAutoCorrector, type ComplianceViolation } from '../security-compliance-auto-corrector'

describe('SecurityComplianceAutoCorrector', () => {
  let corrector: SecurityComplianceAutoCorrector

  const violation: ComplianceViolation = {
    violationId: 'VIO001',
    ruleId: 'OPEN_PORT',
    severity: 'HIGH',
    description: '불필요 포트 8080 개방',
    resourceId: 'SERVER-01',
    autoFixable: true,
  }

  beforeEach(() => {
    corrector = new SecurityComplianceAutoCorrector()
    corrector.registerViolation(violation)
  })

  it('위반 등록 감사 로그', () => {
    const log = corrector.getAuditLog()
    expect(log.some((e) => e.action === 'violation.register')).toBe(true)
  })

  it('자동 교정 가능 → FIXED', () => {
    const report = corrector.correct()
    const result = report.results.find((r) => r.violationId === 'VIO001')!
    expect(result.status).toBe('FIXED')
    expect(result.action).toContain('포트')
  })

  it('autoFixable=false → PENDING_MANUAL', () => {
    corrector.registerViolation({ ...violation, violationId: 'VIO002', autoFixable: false })
    const report = corrector.correct(['VIO002'])
    const result = report.results.find((r) => r.violationId === 'VIO002')!
    expect(result.status).toBe('PENDING_MANUAL')
  })

  it('CRITICAL 미교정 → complianceScore 대폭 감점', () => {
    corrector.registerViolation({ ...violation, violationId: 'VIO003', severity: 'CRITICAL', autoFixable: false, ruleId: 'UNKNOWN_RULE' })
    const report = corrector.correct(['VIO003'])
    expect(report.overallComplianceScore).toBeLessThan(80)
  })

  it('전체 교정 후 fixedCount 집계', () => {
    corrector.registerViolation({ ...violation, violationId: 'VIO004', ruleId: 'WEAK_TLS' })
    const report = corrector.correct()
    expect(report.fixedCount).toBeGreaterThanOrEqual(1)
    expect(report.totalViolations).toBeGreaterThanOrEqual(1)
  })

  it('특정 위반 ID 교정', () => {
    const report = corrector.correct(['VIO001'])
    expect(report.results.length).toBe(1)
    expect(report.results[0]?.violationId).toBe('VIO001')
  })

  it('미등록 위반 ID 교정 에러', () => {
    expect(() => corrector.correct(['UNKNOWN'])).toThrow()
  })

  it('교정 후 감사 로그', () => {
    corrector.correct()
    const log = corrector.getAuditLog()
    expect(log.some((e) => e.action === 'compliance.correct')).toBe(true)
  })
})
