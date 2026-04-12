import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityIncidentTimeline } from '../security-incident-timeline'

describe('SecurityIncidentTimeline', () => {
  let timeline: SecurityIncidentTimeline

  beforeEach(() => {
    timeline = new SecurityIncidentTimeline()
    timeline.ingestEvent({ eventId: 'E1', timestamp: 1000, actor: 'userA', action: 'login_fail', resource: '/login', severity: 'MEDIUM', traceId: 'T1', incidentId: 'INC-1' })
    timeline.ingestEvent({ eventId: 'E2', timestamp: 2000, actor: 'userA', action: 'privilege_escalation', resource: '/admin', severity: 'HIGH', traceId: 'T1', incidentId: 'INC-1' })
    timeline.ingestEvent({ eventId: 'E3', timestamp: 3000, actor: 'userB', action: 'data_exfil', resource: '/data', severity: 'CRITICAL', traceId: 'T2' })
  })

  it('타임라인 필터 없이 시간 순 정렬', () => {
    const events = timeline.buildTimeline()
    expect(events.length).toBe(3)
    expect(events[0]!.eventId).toBe('E1')
    expect(events[2]!.eventId).toBe('E3')
  })

  it('actor 필터 적용', () => {
    const events = timeline.buildTimeline({ actor: 'userA' })
    expect(events.length).toBe(2)
    expect(events.every((e) => e.actor === 'userA')).toBe(true)
  })

  it('시간 범위 필터 적용', () => {
    const events = timeline.buildTimeline({ from: 1500, to: 2500 })
    expect(events.length).toBe(1)
    expect(events[0]!.eventId).toBe('E2')
  })

  it('공격 체인: traceId 기반 이벤트 수집', () => {
    const chain = timeline.buildAttackChain('T1')
    expect(chain.traceId).toBe('T1')
    expect(chain.events.length).toBe(2)
  })

  it('공격 체인: MITRE ATT&CK 매핑 포함', () => {
    const chain = timeline.buildAttackChain('T1')
    expect(chain.mitreMapping).toContain('T1110 (Brute Force)')
    expect(chain.mitreMapping).toContain('T1068 (Exploitation for Privilege Escalation)')
  })

  it('MITRE 매핑 단독 조회', () => {
    expect(timeline.getMitreMapping('data_exfil')).toBe('T1041 (Exfiltration Over C2 Channel)')
    expect(timeline.getMitreMapping('unknown_action')).toBeNull()
  })

  it('감사 로그 복사본 반환', () => {
    timeline.buildTimeline()
    const log = timeline.getAuditLog()
    log.push({ timestamp: '', action: 'injected', detail: {} })
    expect(timeline.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
