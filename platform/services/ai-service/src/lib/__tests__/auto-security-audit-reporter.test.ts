import { describe, it, expect, beforeEach } from 'vitest'
import { AutoSecurityAuditReporter, type AuditScope, type AuditFinding } from '../auto-security-audit-reporter'

describe('AutoSecurityAuditReporter', () => {
  let reporter: AutoSecurityAuditReporter

  const scope: AuditScope = {
    auditId: 'AUDIT001',
    targetSystem: '민원 처리 시스템',
    standards: ['CSAP', 'N2SF'],
    auditedAt: '2026-04-12T00:00:00Z',
  }

  const criticalFinding: AuditFinding = {
    findingId: 'F001',
    category: 'ACCESS_CONTROL',
    severity: 'CRITICAL',
    title: '관리자 페이지 인증 없음',
    description: '/admin 경로 접근 통제 미적용',
    affectedComponent: 'api-gateway',
    remediation: 'RBAC 미들웨어 적용',
  }

  const mediumFinding: AuditFinding = {
    findingId: 'F002',
    category: 'AUDIT_LOG',
    severity: 'MEDIUM',
    title: '감사 로그 누락',
    description: '일부 API 감사 로그 미기록',
    affectedComponent: 'user-service',
    remediation: 'D-06 기준 감사 로그 추가',
  }

  beforeEach(() => {
    reporter = new AutoSecurityAuditReporter()
    reporter.registerAudit(scope)
  })

  it('감사 등록 감사 로그', () => {
    const log = reporter.getAuditLog()
    expect(log.some((e) => e.action === 'audit.register')).toBe(true)
  })

  it('발견사항 없으면 compliance 100점', () => {
    const report = reporter.generateReport('AUDIT001')
    expect(report.complianceScore).toBe(100)
    expect(report.totalFindings).toBe(0)
  })

  it('CRITICAL 발견사항 → 점수 감점', () => {
    reporter.addFinding('AUDIT001', criticalFinding)
    const report = reporter.generateReport('AUDIT001')
    expect(report.complianceScore).toBe(80)  // 100 - 20
  })

  it('CRITICAL 발견사항 → criticalIssues 목록', () => {
    reporter.addFinding('AUDIT001', criticalFinding)
    const report = reporter.generateReport('AUDIT001')
    expect(report.criticalIssues.length).toBe(1)
    expect(report.criticalIssues[0]!.findingId).toBe('F001')
  })

  it('심각도별 집계', () => {
    reporter.addFinding('AUDIT001', criticalFinding)
    reporter.addFinding('AUDIT001', mediumFinding)
    const report = reporter.generateReport('AUDIT001')
    expect(report.bySeverity.CRITICAL).toBe(1)
    expect(report.bySeverity.MEDIUM).toBe(1)
  })

  it('미등록 발견사항 추가 에러', () => {
    expect(() => reporter.addFinding('UNKNOWN', criticalFinding)).toThrow()
  })

  it('미등록 감사 보고서 에러', () => {
    expect(() => reporter.generateReport('UNKNOWN')).toThrow()
  })

  it('보고서 생성 후 감사 로그', () => {
    reporter.generateReport('AUDIT001')
    const log = reporter.getAuditLog()
    expect(log.some((e) => e.action === 'audit.report')).toBe(true)
  })
})
