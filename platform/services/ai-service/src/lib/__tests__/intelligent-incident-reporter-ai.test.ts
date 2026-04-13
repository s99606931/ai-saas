import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentIncidentReporterAi, type IncidentEvent } from '../intelligent-incident-reporter-ai'

describe('IntelligentIncidentReporterAi', () => {
  let reporter: IntelligentIncidentReporterAi

  const resolvedEvent: IncidentEvent = {
    eventId: 'INC001',
    serviceId: 'SVC001',
    severity: 'SEV2',
    title: '민원 API 응답 지연',
    detectedAt: new Date(Date.now() - 120 * 60000).toISOString(),
    resolvedAt: new Date().toISOString(),
    affectedUsers: 500,
    rootCause: '데이터베이스 커넥션 풀 고갈',
    timeline: [
      { timestamp: new Date(Date.now() - 120 * 60000).toISOString(), description: '알림 발생' },
      { timestamp: new Date(Date.now() - 60 * 60000).toISOString(), description: '원인 분석 시작' },
    ],
  }

  beforeEach(() => {
    reporter = new IntelligentIncidentReporterAi()
  })

  it('장애 보고서 생성 — durationMinutes 계산', () => {
    const report = reporter.generateReport(resolvedEvent)
    expect(report.durationMinutes).not.toBeNull()
    expect(report.durationMinutes!).toBeGreaterThan(0)
  })

  it('SLA 위반 감지 — SEV2 4시간 초과', () => {
    const longEvent: IncidentEvent = {
      ...resolvedEvent,
      eventId: 'INC002',
      detectedAt: new Date(Date.now() - 300 * 60000).toISOString(),
      resolvedAt: new Date().toISOString(),
    }
    const report = reporter.generateReport(longEvent)
    expect(report.slaBreached).toBe(true)
    expect(report.actionItems.some((a) => a.includes('SLA'))).toBe(true)
  })

  it('SLA 미위반 — SEV2 2시간 이내', () => {
    const report = reporter.generateReport(resolvedEvent)
    expect(report.slaBreached).toBe(false)
  })

  it('미복구 장애 → durationMinutes null', () => {
    const ongoingEvent: IncidentEvent = { ...resolvedEvent, eventId: 'INC003', resolvedAt: undefined }
    const report = reporter.generateReport(ongoingEvent)
    expect(report.durationMinutes).toBeNull()
  })

  it('원인 없으면 RCA 진행 중 메시지', () => {
    const noRcaEvent: IncidentEvent = { ...resolvedEvent, eventId: 'INC004', rootCause: undefined }
    const report = reporter.generateReport(noRcaEvent)
    expect(report.rootCauseAnalysis).toContain('진행 중')
    expect(report.actionItems.some((a) => a.includes('RCA'))).toBe(true)
  })

  it('SEV1/SEV2 → preventionRecommendations 포함', () => {
    const report = reporter.generateReport(resolvedEvent)
    expect(report.preventionRecommendations.length).toBeGreaterThan(0)
  })

  it('보고서 생성 후 감사 로그', () => {
    reporter.generateReport(resolvedEvent)
    const log = reporter.getAuditLog()
    expect(log.some((e) => e.action === 'incident.report')).toBe(true)
  })
})
