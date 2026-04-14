// Plan SC: SVC-AI-ADV-R487-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { AutoSecurityAuditReporterV2, type SecurityAuditEvent } from '../auto-security-audit-reporter-v2'

describe('AutoSecurityAuditReporterV2', () => {
  let reporter: AutoSecurityAuditReporterV2

  const baseEvent: SecurityAuditEvent = {
    eventId: 'EVT-1',
    eventType: 'LOGIN_FAILURE',
    timestamp: new Date('2026-04-10T10:00:00Z').getTime(),
    userId: 'USER-1',
    resourceId: 'RES-1',
    sourceIp: '10.0.0.1',
    detail: '로그인 실패',
  }

  const periodStart = new Date('2026-04-10T00:00:00Z').getTime()
  const periodEnd = new Date('2026-04-10T23:59:59Z').getTime()

  beforeEach(() => {
    reporter = new AutoSecurityAuditReporterV2()
  })

  it('이벤트 없을 때 → findings=0, LOW 위협', () => {
    const report = reporter.generateReport(periodStart, periodEnd)
    expect(report.findings).toHaveLength(0)
    expect(report.overallThreatLevel).toBe('LOW')
  })

  it('동일 사용자 5회 이상 로그인 실패 → HIGH finding', () => {
    for (let i = 1; i <= 5; i++) {
      reporter.ingestEvent({ ...baseEvent, eventId: `EVT-LF-${i}` })
    }
    const report = reporter.generateReport(periodStart, periodEnd)
    const finding = report.findings.find((f) => f.pattern.includes('로그인 실패'))
    expect(finding).toBeDefined()
    expect(finding!.threatLevel).toBe('HIGH')
  })

  it('권한 상승 이벤트 → CRITICAL finding', () => {
    reporter.ingestEvent({ ...baseEvent, eventId: 'EVT-PE', eventType: 'PRIVILEGE_ESCALATION' })
    const report = reporter.generateReport(periodStart, periodEnd)
    expect(report.findings.some((f) => f.threatLevel === 'CRITICAL')).toBe(true)
    expect(report.overallThreatLevel).toBe('CRITICAL')
  })

  it('C등급 데이터 내보내기 → CRITICAL finding (N2SF)', () => {
    reporter.ingestEvent({ ...baseEvent, eventId: 'EVT-EXP', eventType: 'DATA_EXPORT', dataGrade: 'C' })
    const report = reporter.generateReport(periodStart, periodEnd)
    expect(report.findings.some((f) => f.pattern.includes('C/S 등급'))).toBe(true)
  })

  it('고위험 이벤트 3건 이상 사용자 → highRiskUsers 포함', () => {
    for (let i = 0; i < 3; i++) {
      reporter.ingestEvent({ ...baseEvent, eventId: `EVT-HR-${i}`, eventType: 'DATA_EXPORT', userId: 'HIGH-RISK-USER' })
    }
    const report = reporter.generateReport(periodStart, periodEnd)
    expect(report.highRiskUsers).toContain('HIGH-RISK-USER')
  })

  it('generatedAt 포함', () => {
    const report = reporter.generateReport(periodStart, periodEnd)
    expect(report.generatedAt).toBeTruthy()
  })

  it('기간 외 이벤트 → 포함되지 않음', () => {
    reporter.ingestEvent({ ...baseEvent, eventId: 'EVT-OUT', timestamp: new Date('2026-04-09T10:00:00Z').getTime() })
    const report = reporter.generateReport(periodStart, periodEnd)
    expect(report.totalEvents).toBe(0)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    reporter.ingestEvent(baseEvent)
    reporter.generateReport(periodStart, periodEnd)
    const log1 = reporter.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', reportId: 'X', detail: {} })
    const log2 = reporter.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
