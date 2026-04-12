import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityPolicyEnforcerAI } from '../security-policy-enforcer-ai'

describe('SecurityPolicyEnforcerAI', () => {
  let enforcer: SecurityPolicyEnforcerAI

  beforeEach(() => {
    enforcer = new SecurityPolicyEnforcerAI()
    enforcer.registerPolicy({
      policyId: 'POL-1',
      name: 'IP 차단 정책',
      status: 'ACTIVE',
      priority: 1,
      rules: [{ ruleId: 'R-1', condition: 'IP_BLOCKED', value: '' }],
    })
    enforcer.registerPolicy({
      policyId: 'POL-2',
      name: '관리자 권한 정책',
      status: 'ACTIVE',
      priority: 2,
      rules: [{ ruleId: 'R-2', condition: 'ROLE_REQUIRED', value: 'ADMIN' }],
    })
    enforcer.blockIp('10.0.0.99')
  })

  it('차단 IP — BLOCKED', () => {
    const result = enforcer.enforce({ requestId: 'REQ-1', userId: 'U-1', sourceIp: '10.0.0.99', role: 'USER', resource: '/admin', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.result).toBe('BLOCKED')
    expect(result.reason).toContain('차단 IP')
  })

  it('권한 부족 — BLOCKED', () => {
    const result = enforcer.enforce({ requestId: 'REQ-2', userId: 'U-2', sourceIp: '192.168.1.1', role: 'USER', resource: '/admin', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.result).toBe('BLOCKED')
    expect(result.reason).toContain('권한 부족')
  })

  it('정상 요청 — ALLOWED', () => {
    const result = enforcer.enforce({ requestId: 'REQ-3', userId: 'U-3', sourceIp: '192.168.1.1', role: 'ADMIN', resource: '/admin', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.result).toBe('ALLOWED')
  })

  it('속도 제한 초과 — WARNED', () => {
    enforcer.registerPolicy({
      policyId: 'POL-3',
      name: '속도 제한',
      status: 'ACTIVE',
      priority: 3,
      rules: [{ ruleId: 'R-3', condition: 'RATE_LIMIT', value: '100' }],
    })
    const result = enforcer.enforce({ requestId: 'REQ-4', userId: 'U-4', sourceIp: '192.168.1.2', role: 'ADMIN', resource: '/api', timestamp: '2026-04-12T10:00:00Z', requestCount: 150 })
    expect(result.result).toBe('WARNED')
  })

  it('INACTIVE 정책은 적용 안됨', () => {
    enforcer.registerPolicy({
      policyId: 'POL-4',
      name: '비활성 정책',
      status: 'INACTIVE',
      priority: 0,
      rules: [{ ruleId: 'R-4', condition: 'ROLE_REQUIRED', value: 'SUPERADMIN' }],
    })
    const result = enforcer.enforce({ requestId: 'REQ-5', userId: 'U-5', sourceIp: '192.168.1.3', role: 'ADMIN', resource: '/data', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.result).toBe('ALLOWED')
  })

  it('감사 로그 복사본 반환', () => {
    enforcer.enforce({ requestId: 'REQ-6', userId: 'U-6', sourceIp: '192.168.1.4', role: 'ADMIN', resource: '/api', timestamp: '2026-04-12T10:00:00Z' })
    const log = enforcer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', requestId: 'X', detail: {} })
    expect(enforcer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
