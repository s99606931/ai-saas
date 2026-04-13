import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeThreatIntelligenceAi, type ThreatEvent, type ThreatIndicator } from '../realtime-threat-intelligence-ai'

describe('RealtimeThreatIntelligenceAi', () => {
  let ai: RealtimeThreatIntelligenceAi
  const now = Date.now()

  const makeEvent = (type: ThreatEvent['eventType'], count = 1): ThreatEvent[] =>
    Array.from({ length: count }, (_, i) => ({
      eventId: `EVT-${type}-${i}`,
      sourceIp: '192.168.1.100',
      eventType: type,
      timestamp: now - i * 1000,
      targetResourceId: 'SERVER-01',
    }))

  beforeEach(() => {
    ai = new RealtimeThreatIntelligenceAi()
  })

  it('이벤트 없으면 SAFE', () => {
    const result = ai.assess('10.0.0.1')
    expect(result.threatLevel).toBe('SAFE')
    expect(result.threatScore).toBe(0)
  })

  it('PRIVILEGE_ESC → CRITICAL + 패턴 감지', () => {
    makeEvent('PRIVILEGE_ESC', 1).forEach((e) => ai.ingestEvent(e))
    const result = ai.assess('192.168.1.100')
    expect(result.threatLevel).toBe('CRITICAL')
    expect(result.detectedPatterns).toContain('PRIVILEGE_ESCALATION')
  })

  it('LOGIN_FAIL 5회 이상 → BRUTE_FORCE 패턴', () => {
    makeEvent('LOGIN_FAIL', 6).forEach((e) => ai.ingestEvent(e))
    const result = ai.assess('192.168.1.100')
    expect(result.detectedPatterns).toContain('BRUTE_FORCE')
  })

  it('PORT_SCAN 3회 이상 → PORT_SCANNING 패턴', () => {
    makeEvent('PORT_SCAN', 4).forEach((e) => ai.ingestEvent(e))
    const result = ai.assess('192.168.1.100')
    expect(result.detectedPatterns).toContain('PORT_SCANNING')
  })

  it('위협 인디케이터 IP 매칭 → 점수 추가', () => {
    const indicator: ThreatIndicator = {
      indicatorId: 'IND001',
      type: 'IP',
      value: '192.168.1.100',
      threatLevel: 'HIGH',
      description: '알려진 공격자 IP',
    }
    ai.registerIndicator(indicator)
    makeEvent('LOGIN_FAIL', 2).forEach((e) => ai.ingestEvent(e))
    const result = ai.assess('192.168.1.100')
    expect(result.detectedPatterns.some((p) => p.includes('KNOWN_THREAT_IP'))).toBe(true)
    expect(result.threatScore).toBeGreaterThan(30)
  })

  it('IP 마스킹 적용', () => {
    const result = ai.assess('192.168.1.100')
    expect(result.maskedIp).toBe('192.168.*.*')
    expect(result.maskedIp).not.toContain('100')
  })

  it('CRITICAL 위협 → recommendedActions 생성', () => {
    makeEvent('PRIVILEGE_ESC', 3).forEach((e) => ai.ingestEvent(e))
    const result = ai.assess('192.168.1.100')
    expect(result.recommendedActions.some((a) => a.includes('즉시'))).toBe(true)
  })

  it('이벤트 수집 감사 로그', () => {
    makeEvent('PORT_SCAN', 1).forEach((e) => ai.ingestEvent(e))
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'event.ingest')).toBe(true)
  })

  it('평가 후 감사 로그', () => {
    ai.assess('10.0.0.1')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'threat.assess')).toBe(true)
  })
})
