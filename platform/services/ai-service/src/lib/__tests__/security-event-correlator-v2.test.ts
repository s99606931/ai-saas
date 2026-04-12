import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityEventCorrelatorV2 } from '../security-event-correlator-v2'

describe('SecurityEventCorrelatorV2', () => {
  let c: SecurityEventCorrelatorV2

  beforeEach(() => {
    c = new SecurityEventCorrelatorV2()
  })

  const baseEv = (id: string, offset: number, type: 'LOGIN_FAIL' | 'PORT_SCAN' | 'PRIV_ESC' | 'FILE_ACCESS' | 'UNKNOWN', ip = '10.0.0.5') => ({
    eventId: id,
    timestamp: new Date(Date.UTC(2026, 3, 10, 10, 0, offset)).toISOString(),
    sourceIp: ip,
    eventType: type,
  })

  it('C등급 차단', () => {
    expect(() => c.ingestEvent(baseEv('e1', 0, 'LOGIN_FAIL'), 'C', 'a')).toThrow('BLOCKED')
  })

  it('빈 eventId 차단', () => {
    expect(() => c.ingestEvent({ ...baseEv('', 0, 'LOGIN_FAIL') }, 'O', 'a')).toThrow('eventId')
  })

  it('유효하지 않은 IP 차단', () => {
    expect(() =>
      c.ingestEvent({ ...baseEv('e1', 0, 'LOGIN_FAIL'), sourceIp: 'bad' }, 'O', 'a')
    ).toThrow('유효하지 않은')
  })

  it('BRUTE_FORCE 탐지 — 5회 로그인 실패', () => {
    for (let i = 0; i < 6; i++) {
      c.ingestEvent(baseEv(`e${i}`, i, 'LOGIN_FAIL'), 'O', 'a')
    }
    const groups = c.correlate()
    expect(groups.length).toBe(1)
    expect(groups[0]?.pattern).toBe('BRUTE_FORCE')
    expect(groups[0]?.threatLevel).toBe('HIGH')
  })

  it('PRIV_ESC 탐지 — CRITICAL', () => {
    c.ingestEvent(baseEv('e1', 0, 'LOGIN_FAIL'), 'O', 'a')
    c.ingestEvent(baseEv('e2', 1, 'PRIV_ESC'), 'O', 'a')
    const groups = c.correlate()
    expect(groups[0]?.pattern).toBe('PRIVILEGE_ESCALATION')
    expect(groups[0]?.threatLevel).toBe('CRITICAL')
  })

  it('PORT_SCANNING — 3회+', () => {
    for (let i = 0; i < 4; i++) {
      c.ingestEvent(baseEv(`s${i}`, i, 'PORT_SCAN'), 'O', 'a')
    }
    const groups = c.correlate()
    expect(groups[0]?.pattern).toBe('PORT_SCANNING')
    expect(groups[0]?.threatLevel).toBe('MED')
  })

  it('MIXED_ATTACK — 3가지 이상 타입', () => {
    c.ingestEvent(baseEv('a', 0, 'LOGIN_FAIL'), 'O', 'a')
    c.ingestEvent(baseEv('b', 1, 'PORT_SCAN'), 'O', 'a')
    c.ingestEvent(baseEv('c', 2, 'FILE_ACCESS'), 'O', 'a')
    const groups = c.correlate()
    expect(groups[0]?.pattern).toBe('MIXED_ATTACK')
  })

  it('IP별 분리 그룹화', () => {
    c.ingestEvent(baseEv('a', 0, 'LOGIN_FAIL', '10.0.0.1'), 'O', 'a')
    c.ingestEvent(baseEv('b', 1, 'LOGIN_FAIL', '10.0.0.1'), 'O', 'a')
    c.ingestEvent(baseEv('c', 2, 'LOGIN_FAIL', '10.0.0.2'), 'O', 'a')
    c.ingestEvent(baseEv('d', 3, 'LOGIN_FAIL', '10.0.0.2'), 'O', 'a')
    const groups = c.correlate()
    expect(groups.length).toBe(2)
    const ips = groups.map((g) => g.sourceIpMasked).sort()
    expect(ips[0]).toBe('10.0.0.***')
  })

  it('단일 이벤트 — 그룹 생성 안됨', () => {
    c.ingestEvent(baseEv('solo', 0, 'LOGIN_FAIL'), 'O', 'a')
    expect(c.correlate()).toHaveLength(0)
  })

  it('윈도우 밖 이벤트 — 분리 그룹', () => {
    c.ingestEvent(
      {
        eventId: 'a',
        timestamp: '2026-04-10T10:00:00Z',
        sourceIp: '10.0.0.1',
        eventType: 'LOGIN_FAIL',
      },
      'O',
      'a'
    )
    c.ingestEvent(
      {
        eventId: 'b',
        timestamp: '2026-04-10T10:00:10Z',
        sourceIp: '10.0.0.1',
        eventType: 'LOGIN_FAIL',
      },
      'O',
      'a'
    )
    // 10분 후 — 5분 윈도우 밖
    c.ingestEvent(
      {
        eventId: 'c',
        timestamp: '2026-04-10T10:10:00Z',
        sourceIp: '10.0.0.1',
        eventType: 'LOGIN_FAIL',
      },
      'O',
      'a'
    )
    const groups = c.correlate(300000)
    // 첫 윈도우에 a,b / 별도 c 는 단일이라 그룹 제외
    expect(groups.length).toBe(1)
    expect(groups[0]?.eventCount).toBe(2)
  })

  it('IP 마스킹 확인', () => {
    c.ingestEvent(baseEv('a', 0, 'LOGIN_FAIL', '192.168.1.100'), 'O', 'a')
    c.ingestEvent(baseEv('b', 1, 'LOGIN_FAIL', '192.168.1.100'), 'O', 'a')
    const groups = c.correlate()
    expect(groups[0]?.sourceIpMasked).toBe('192.168.1.***')
  })

  it('getEventCount', () => {
    c.ingestEvent(baseEv('a', 0, 'LOGIN_FAIL'), 'O', 'a')
    expect(c.getEventCount()).toBe(1)
  })

  it('감사 로그 — 마스킹', () => {
    c.ingestEvent(baseEv('a', 0, 'LOGIN_FAIL'), 'O', 'caller-long')
    const log = c.getAuditLog()
    const ev = log.find((e) => e.action === 'event.ingest')
    expect(ev?.callerMasked).toContain('***')
    expect(ev?.detail.sourceIpMasked).toContain('***')
  })

  it('SUSPICIOUS_LOGIN — 2~4회', () => {
    c.ingestEvent(baseEv('a', 0, 'LOGIN_FAIL'), 'O', 'a')
    c.ingestEvent(baseEv('b', 1, 'LOGIN_FAIL'), 'O', 'a')
    const groups = c.correlate()
    expect(groups[0]?.pattern).toBe('SUSPICIOUS_LOGIN')
    expect(groups[0]?.threatLevel).toBe('MED')
  })
})
