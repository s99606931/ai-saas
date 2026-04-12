import { describe, it, expect, beforeEach } from 'vitest'
import { ApiMonitoringAi, type ApiEndpointConfig, type ApiCallRecord } from '../api-monitoring-ai'

describe('ApiMonitoringAi', () => {
  let monitor: ApiMonitoringAi

  const config: ApiEndpointConfig = {
    endpointId: 'EP001',
    path: '/api/v1/complaints',
    method: 'GET',
    slaResponseMs: 500,
    errorRateThreshold: 0.1,
  }

  const makeCall = (responseMs: number, success: boolean): ApiCallRecord => ({
    endpointId: 'EP001',
    timestamp: Date.now(),
    responseMs,
    statusCode: success ? 200 : 500,
    success,
  })

  beforeEach(() => {
    monitor = new ApiMonitoringAi()
    monitor.registerEndpoint(config)
  })

  it('엔드포인트 등록 감사 로그', () => {
    const log = monitor.getAuditLog()
    expect(log.some((e) => e.action === 'endpoint.register')).toBe(true)
  })

  it('호출 없으면 NO_TRAFFIC 알림', () => {
    const report = monitor.analyze('EP001')
    expect(report.alerts.some((a) => a.alertType === 'NO_TRAFFIC')).toBe(true)
  })

  it('SLA 초과 → SLA_BREACH 알림', () => {
    for (let i = 0; i < 5; i++) monitor.recordCall(makeCall(1200, true))
    const report = monitor.analyze('EP001')
    expect(report.alerts.some((a) => a.alertType === 'SLA_BREACH')).toBe(true)
  })

  it('에러율 초과 → ERROR_RATE 알림', () => {
    for (let i = 0; i < 3; i++) monitor.recordCall(makeCall(100, true))
    for (let i = 0; i < 7; i++) monitor.recordCall(makeCall(100, false))
    const report = monitor.analyze('EP001')
    expect(report.alerts.some((a) => a.alertType === 'ERROR_RATE')).toBe(true)
  })

  it('정상 호출 — 알림 없음', () => {
    for (let i = 0; i < 10; i++) monitor.recordCall(makeCall(100, true))
    const report = monitor.analyze('EP001')
    expect(report.alerts.length).toBe(0)
    expect(report.errorRate).toBe(0)
  })

  it('미등록 엔드포인트 호출 기록 에러', () => {
    expect(() => monitor.recordCall({ ...makeCall(100, true), endpointId: 'UNKNOWN' })).toThrow()
  })

  it('미등록 엔드포인트 분석 에러', () => {
    expect(() => monitor.analyze('UNKNOWN')).toThrow()
  })

  it('알림 엔드포인트별 필터', () => {
    for (let i = 0; i < 5; i++) monitor.recordCall(makeCall(1500, true))
    monitor.analyze('EP001')
    const alerts = monitor.getAlerts('EP001')
    expect(alerts.every((a) => a.endpointId === 'EP001')).toBe(true)
  })

  it('분석 후 감사 로그 기록', () => {
    for (let i = 0; i < 3; i++) monitor.recordCall(makeCall(100, true))
    monitor.analyze('EP001')
    const log = monitor.getAuditLog()
    expect(log.some((e) => e.action === 'endpoint.analyze')).toBe(true)
  })
})
