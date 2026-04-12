import { describe, it, expect, beforeEach } from 'vitest'
import { AuthTokenLifecycleManagerAI } from '../auth-token-lifecycle-manager-ai'

describe('AuthTokenLifecycleManagerAI', () => {
  let ai: AuthTokenLifecycleManagerAI

  beforeEach(() => {
    ai = new AuthTokenLifecycleManagerAI()
  })

  it('토큰 발급 및 감사 로그', () => {
    const token = ai.issueToken('user1', 'access', 60000)
    expect(token.id).toBeDefined()
    expect(token.owner).toBe('user1')
    expect(token.status).toBe('active')
    expect(ai.getAuditLog().some((e) => e.action === 'token.issue')).toBe(true)
  })

  it('유효 토큰 검증', () => {
    const token = ai.issueToken('user1', 'access', 60000)
    const result = ai.validateToken(token.id)
    expect(result.valid).toBe(true)
    expect(result.reason).toBe('OK')
  })

  it('토큰 폐기 후 검증 실패', () => {
    const token = ai.issueToken('user1', 'access', 60000)
    ai.revokeToken(token.id)
    const result = ai.validateToken(token.id)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('REVOKED')
  })

  it('토큰 갱신', () => {
    const token = ai.issueToken('user1', 'access', 60000)
    const renewed = ai.renewToken(token.id, 120000)
    expect(renewed.expiresAt).toBeGreaterThan(token.expiresAt)
    expect(renewed.status).toBe('active')
  })

  it('미존재 토큰 검증 — NOT_FOUND', () => {
    const result = ai.validateToken('nonexistent-id')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('NOT_FOUND')
  })

  it('폐기된 토큰 갱신 불가', () => {
    const token = ai.issueToken('user1', 'access', 60000)
    ai.revokeToken(token.id)
    expect(() => ai.renewToken(token.id)).toThrow()
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.issueToken('user1', 'access', 60000, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 차단', () => {
    expect(() => ai.issueToken('user1', 'access', 60000, 'S')).toThrow('BLOCKED')
  })
})
