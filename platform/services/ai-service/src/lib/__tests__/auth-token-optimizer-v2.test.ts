// Plan SC: SVC-AI-ADV-R411
import { describe, it, expect, beforeEach } from 'vitest'
import { AuthTokenOptimizerV2 } from '../auth-token-optimizer-v2'

describe('AuthTokenOptimizerV2', () => {
  let optimizer: AuthTokenOptimizerV2

  beforeEach(() => {
    optimizer = new AuthTokenOptimizerV2()
  })

  it('issueToken — 감사 로그에 token.issue 기록', () => {
    optimizer.issueToken('user1', 'access', 900000)
    const log = optimizer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('token.issue')
  })

  it('getTokenStatus — 만료되지 않은 토큰 active', () => {
    const token = optimizer.issueToken('user1', 'access', 900000)
    expect(optimizer.getTokenStatus(token.id)).toBe('active')
  })

  it('getTokenStatus — revoked 토큰 revoked', () => {
    const token = optimizer.issueToken('user1', 'access', 900000)
    optimizer.revokeToken(token.id)
    expect(optimizer.getTokenStatus(token.id)).toBe('revoked')
  })

  it('getTokenStatus — ttlMs=1 으로 발급 후 만료 대기', () => {
    const token = optimizer.issueToken('user1', 'access', 1)
    // expiresAt = issuedAt + 1ms, 곧 만료됨
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(optimizer.getTokenStatus(token.id)).toBe('expired')
        resolve()
      }, 5)
    })
  })

  it('getExpiringTokens — warningMs 내 만료 예정 토큰 반환', () => {
    const token = optimizer.issueToken('user1', 'access', 5000) // 5초 후 만료
    const expiring = optimizer.getExpiringTokens(10000) // 10초 이내 만료 예정
    expect(expiring.some((t) => t.id === token.id)).toBe(true)
  })

  it('getExpiringTokens — 충분히 긴 TTL 토큰은 포함하지 않음', () => {
    optimizer.issueToken('user1', 'access', 3600000) // 1시간
    const expiring = optimizer.getExpiringTokens(10000) // 10초
    expect(expiring).toHaveLength(0)
  })

  it('revokeToken — 감사 로그에 token.revoke 기록', () => {
    const token = optimizer.issueToken('user1', 'access', 900000)
    optimizer.revokeToken(token.id)
    const log = optimizer.getAuditLog()
    expect(log[1]!.action).toBe('token.revoke')
  })

  it('revokeToken — 없는 tokenId 에러', () => {
    expect(() => optimizer.revokeToken('nonexistent')).toThrow('tokenId 없음')
  })
})
