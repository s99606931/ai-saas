import { describe, it, expect, beforeEach } from 'vitest'
import { AuditTrailEnhancerAI } from '../audit-trail-enhancer-ai'

describe('AuditTrailEnhancerAI', () => {
  let ai: AuditTrailEnhancerAI

  beforeEach(() => {
    ai = new AuditTrailEnhancerAI()
    ai.registerPolicy('p1', '관리자 접근 정책', ['users', 'reports'], 3, 60000)
  })

  it('정책 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'policy.register')).toBe(true)
  })

  it('정상 이벤트 기록 — 위험 경보 없음', () => {
    ai.recordEvent('p1', 'admin1', 'users', 'READ')
    expect(ai.getRiskAlerts('p1').length).toBe(0)
  })

  it('허가되지 않은 접근 — unauthorized_access 경보', () => {
    ai.recordEvent('p1', 'admin1', 'secret-files', 'READ')
    const alerts = ai.getRiskAlerts('p1')
    expect(alerts.some((a) => a.alertType === 'unauthorized_access')).toBe(true)
  })

  it('actorId SHA-256 마스킹 — 16자', () => {
    ai.recordEvent('p1', 'user-hong-gildong', 'users', 'READ')
    const log = ai.getEnhancedLog()
    expect(log[0]!.maskedActorId.length).toBe(16)
  })

  it('시간 창 내 빈도 초과 — suspicious_frequency 경보', () => {
    for (let i = 0; i < 5; i++) ai.recordEvent('p1', 'attacker', 'users', 'READ')
    const alerts = ai.getRiskAlerts('p1')
    expect(alerts.some((a) => a.alertType === 'suspicious_frequency')).toBe(true)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordEvent('p1', 'admin1', 'users', 'READ', 'C')).toThrow('BLOCKED')
  })

  it('미등록 정책 에러', () => {
    expect(() => ai.recordEvent('unknown', 'admin1', 'users', 'READ')).toThrow()
  })
})
