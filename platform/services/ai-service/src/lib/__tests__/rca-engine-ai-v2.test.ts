import { describe, it, expect, beforeEach } from 'vitest'
import { RcaEngineAiV2, type Incident, type IncidentEvent } from '../rca-engine-ai-v2'

describe('RcaEngineAiV2', () => {
  let engine: RcaEngineAiV2

  const incident: Incident = {
    incidentId: 'INC-001',
    title: '서비스 장애',
    severity: 'P1',
    startedAt: '2026-04-11T09:00:00Z',
    affectedServices: ['api-gateway', 'user-service'],
    symptoms: ['응답 없음', 'CPU 과부하'],
  }

  beforeEach(() => {
    engine = new RcaEngineAiV2()
    engine.registerIncident(incident)
  })

  it('장애 등록 감사 로그', () => {
    const log = engine.getAuditLog()
    expect(log.some((e) => e.action === 'incident.register')).toBe(true)
  })

  it('이벤트 없으면 INSUFFICIENT_DATA', () => {
    const result = engine.analyze('INC-001')
    expect(result.status).toBe('INSUFFICIENT_DATA')
    expect(result.rootCause).toBe('UNKNOWN')
  })

  it('OOM 이벤트 → INFRASTRUCTURE 원인', () => {
    engine.addEvent({ eventId: 'E1', incidentId: 'INC-001', timestamp: '2026-04-11T09:01:00Z', source: 'k8s', eventType: 'ERROR', message: 'OOM killed process, memory out of memory' })
    engine.addEvent({ eventId: 'E2', incidentId: 'INC-001', timestamp: '2026-04-11T09:02:00Z', source: 'node', eventType: 'ERROR', message: 'cpu spike detected memory usage high' })
    const result = engine.analyze('INC-001')
    expect(result.rootCause).toBe('INFRASTRUCTURE')
    expect(result.status).toBe('COMPLETED')
  })

  it('데이터베이스 이벤트 → DATABASE 원인', () => {
    engine.addEvent({ eventId: 'E3', incidentId: 'INC-001', timestamp: '2026-04-11T09:01:00Z', source: 'db', eventType: 'ERROR', message: 'deadlock detected in connection pool' })
    engine.addEvent({ eventId: 'E4', incidentId: 'INC-001', timestamp: '2026-04-11T09:02:00Z', source: 'db', eventType: 'ERROR', message: 'db error query timeout connection pool exhausted' })
    const result = engine.analyze('INC-001')
    expect(result.rootCause).toBe('DATABASE')
  })

  it('타임라인 생성', () => {
    engine.addEvent({ eventId: 'E5', incidentId: 'INC-001', timestamp: '2026-04-11T09:01:00Z', source: 'app', eventType: 'ERROR', message: 'exception thrown null pointer error' })
    const result = engine.analyze('INC-001')
    expect(result.timeline.length).toBeGreaterThan(0)
  })

  it('미등록 장애 이벤트 추가 에러', () => {
    const event: IncidentEvent = { eventId: 'E6', incidentId: 'UNKNOWN', timestamp: '2026-04-11T09:00:00Z', source: 'app', eventType: 'ERROR', message: 'error' }
    expect(() => engine.addEvent(event)).toThrow()
  })

  it('미등록 장애 분석 에러', () => {
    expect(() => engine.analyze('UNKNOWN')).toThrow()
  })

  it('분석 완료 감사 로그', () => {
    engine.addEvent({ eventId: 'E7', incidentId: 'INC-001', timestamp: '2026-04-11T09:01:00Z', source: 'app', eventType: 'ERROR', message: 'exception error' })
    engine.analyze('INC-001')
    const log = engine.getAuditLog()
    expect(log.some((e) => e.action === 'incident.analyze')).toBe(true)
  })
})
