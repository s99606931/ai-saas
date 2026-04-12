import { describe, it, expect, beforeEach } from 'vitest'
import { PrivilegeEscalationDetector } from '../privilege-escalation-detector'

describe('PrivilegeEscalationDetector', () => {
  let detector: PrivilegeEscalationDetector

  beforeEach(() => {
    detector = new PrivilegeEscalationDetector()
    detector.registerSession({ userId: 'U-1', currentRole: 'USER', department: '기획팀', lastLoginAt: '2026-04-12T09:00:00Z' })
    detector.registerSession({ userId: 'U-2', currentRole: 'OPERATOR', department: '운영팀', lastLoginAt: '2026-04-12T09:00:00Z' })
  })

  it('알 수 없는 사용자 탐지 시 오류', () => {
    expect(() => detector.detect({ eventId: 'EV-1', userId: 'UNKNOWN', requestedRole: 'ADMIN', resource: '/admin', timestamp: '2026-04-12T10:00:00Z', sourceIp: '10.0.0.1' })).toThrow('Unknown user')
  })

  it('권한 동일 요청 — 탐지 없음', () => {
    const result = detector.detect({ eventId: 'EV-2', userId: 'U-1', requestedRole: 'USER', resource: '/data', timestamp: '2026-04-12T10:00:00Z', sourceIp: '10.0.0.1' })
    expect(result.escalationDetected).toBe(false)
    expect(result.severity).toBe('NONE')
    expect(result.blocked).toBe(false)
  })

  it('1단계 상승 — MEDIUM, 차단 없음', () => {
    const result = detector.detect({ eventId: 'EV-3', userId: 'U-1', requestedRole: 'OPERATOR', resource: '/ops', timestamp: '2026-04-12T10:00:00Z', sourceIp: '10.0.0.1' })
    expect(result.escalationDetected).toBe(true)
    expect(result.severity).toBe('MEDIUM')
    expect(result.blocked).toBe(false)
    expect(result.levelJump).toBe(1)
  })

  it('2단계 상승 — HIGH, 차단', () => {
    const result = detector.detect({ eventId: 'EV-4', userId: 'U-1', requestedRole: 'ADMIN', resource: '/admin', timestamp: '2026-04-12T10:00:00Z', sourceIp: '10.0.0.1' })
    expect(result.severity).toBe('HIGH')
    expect(result.blocked).toBe(true)
  })

  it('3단계 이상 상승 — CRITICAL, 차단', () => {
    const result = detector.detect({ eventId: 'EV-5', userId: 'U-1', requestedRole: 'SUPERADMIN', resource: '/superadmin', timestamp: '2026-04-12T10:00:00Z', sourceIp: '10.0.0.1' })
    expect(result.severity).toBe('CRITICAL')
    expect(result.blocked).toBe(true)
    expect(result.levelJump).toBeGreaterThanOrEqual(3)
  })

  it('감사 로그 복사본 반환', () => {
    detector.detect({ eventId: 'EV-6', userId: 'U-1', requestedRole: 'USER', resource: '/data', timestamp: '2026-04-12T10:00:00Z', sourceIp: '10.0.0.1' })
    const log = detector.getAuditLog()
    log.push({ timestamp: '', action: 'injected', userId: 'X', detail: {} })
    expect(detector.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
