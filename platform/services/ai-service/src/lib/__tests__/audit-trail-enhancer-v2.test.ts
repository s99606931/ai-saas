// Plan SC: SVC-AI-ADV-R445
import { describe, it, expect, beforeEach } from 'vitest'
import { AuditTrailEnhancerV2 } from '../audit-trail-enhancer-v2'

describe('AuditTrailEnhancerV2', () => {
  let enhancer: AuditTrailEnhancerV2

  beforeEach(() => {
    enhancer = new AuditTrailEnhancerV2()
  })

  it('recordEvent — 감사 로그에 audit.record 기록', () => {
    enhancer.recordEvent('LOGIN', 'admin001', 'system')
    expect(enhancer.getAuditLog()[0]!.action).toBe('audit.record')
  })

  it('recordEvent — maskedActorId는 16자 hex (PII 보호)', () => {
    const event = enhancer.recordEvent('LOGIN', 'admin001', 'system')
    expect(event.maskedActorId).toHaveLength(16)
    expect(event.maskedActorId).not.toBe('admin001')
  })

  it('recordEvent — 체크섬은 16자 hex', () => {
    const event = enhancer.recordEvent('LOGIN', 'admin001', 'system')
    expect(event.checksum).toHaveLength(16)
  })

  it('recordEvent — 동일 입력은 동일 체크섬 생성', () => {
    const e1 = enhancer.recordEvent('LOGIN', 'admin001', 'system')
    const e2 = enhancer.recordEvent('LOGIN', 'admin001', 'system')
    expect(e1.checksum).toBe(e2.checksum)
  })

  it('getEventTypeStats — 이벤트 타입별 통계', () => {
    enhancer.recordEvent('LOGIN', 'u1', 'sys')
    enhancer.recordEvent('LOGIN', 'u2', 'sys')
    enhancer.recordEvent('DELETE', 'u1', 'resource-1')
    const stats = enhancer.getEventTypeStats()
    expect(stats['LOGIN']).toBe(2)
    expect(stats['DELETE']).toBe(1)
  })

  it('getEventsByType — 특정 타입 이벤트 필터링', () => {
    enhancer.recordEvent('LOGIN', 'u1', 'sys')
    enhancer.recordEvent('DELETE', 'u1', 'r1')
    expect(enhancer.getEventsByType('LOGIN')).toHaveLength(1)
    expect(enhancer.getEventsByType('DELETE')).toHaveLength(1)
  })

  it('recordEvent — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => enhancer.recordEvent('LOGIN', 'u1', 'sys', 'C')).toThrow('BLOCKED')
  })

  it('recordEvent — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => enhancer.recordEvent('LOGIN', 'u1', 'sys', 'S')).toThrow('N2SF N-05')
  })
})
