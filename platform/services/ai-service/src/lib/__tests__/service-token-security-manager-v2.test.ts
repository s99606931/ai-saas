import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceTokenSecurityManagerV2 } from '../service-token-security-manager-v2'

describe('ServiceTokenSecurityManagerV2', () => {
  let manager: ServiceTokenSecurityManagerV2

  beforeEach(() => {
    manager = new ServiceTokenSecurityManagerV2()
  })

  it('토큰 등록 후 조회 가능', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const token = manager.registerToken('tok-1', 'svc-1', 'jwt', future)
    expect(token.tokenId).toBe('tok-1')
    expect(token.tokenType).toBe('jwt')
  })

  it('미만료 토큰: isExpired false', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    manager.registerToken('tok-1', 'svc-1', 'jwt', future)
    expect(manager.isExpired('tok-1')).toBe(false)
  })

  it('만료 토큰: isExpired true', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    manager.registerToken('tok-1', 'svc-1', 'jwt', past)
    expect(manager.isExpired('tok-1')).toBe(true)
  })

  it('getExpiredTokens: 만료 토큰만 반환', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    manager.registerToken('tok-1', 'svc-1', 'jwt', future)
    manager.registerToken('tok-2', 'svc-1', 'jwt', past)
    const expired = manager.getExpiredTokens()
    expect(expired.map((t) => t.tokenId)).toContain('tok-2')
    expect(expired.map((t) => t.tokenId)).not.toContain('tok-1')
  })

  it('recordUsage 정상 기록', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    manager.registerToken('tok-1', 'svc-1', 'jwt', future)
    manager.recordUsage('tok-1', 'client-1')
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'RECORD_USAGE')).toBe(true)
  })

  it('C등급 데이터 전송 차단', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    manager.registerToken('tok-1', 'svc-1', 'jwt', future)
    expect(() => manager.recordUsage('tok-1', 'client-1', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    manager.registerToken('tok-1', 'svc-1', 'jwt', future)
    expect(() => manager.recordUsage('tok-1', 'client-1', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    manager.registerToken('tok-1', 'svc-1', 'jwt', future)
    manager.recordUsage('tok-1', 'client-1')
    const log = manager.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
