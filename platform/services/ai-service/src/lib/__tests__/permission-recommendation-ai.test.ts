import { describe, it, expect, beforeEach } from 'vitest'
import { PermissionRecommendationAi, type UserProfile, type AccessPattern } from '../permission-recommendation-ai'

describe('PermissionRecommendationAi', () => {
  let ai: PermissionRecommendationAi

  const profile: UserProfile = {
    userId: 'U001',
    name: '홍길동',
    department: '행정팀',
    jobTitle: '주임',
    currentRoles: ['ADMIN'],
  }

  beforeEach(() => {
    ai = new PermissionRecommendationAi()
    ai.registerUser(profile)
  })

  it('사용자 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'user.register')).toBe(true)
  })

  it('패턴 없으면 VIEWER 권고', () => {
    const result = ai.recommend('U001')
    expect(result.recommendedRoles).toContain('VIEWER')
  })

  it('READ 패턴만 → VIEWER 권고', () => {
    const p: AccessPattern = { userId: 'U001', resource: 'doc', action: 'READ', frequency: 10 }
    ai.recordPattern(p)
    const result = ai.recommend('U001')
    expect(result.recommendedRoles).toContain('VIEWER')
  })

  it('ADMIN 패턴 → ADMIN 권고', () => {
    ai.recordPattern({ userId: 'U001', resource: 'sys', action: 'ADMIN', frequency: 1 })
    const result = ai.recommend('U001')
    expect(result.recommendedRoles).toContain('ADMIN')
  })

  it('WRITE 패턴만 → USER 권고', () => {
    ai.registerUser({ ...profile, userId: 'U002', currentRoles: ['USER'] })
    ai.recordPattern({ userId: 'U002', resource: 'form', action: 'WRITE', frequency: 5 })
    const result = ai.recommend('U002')
    expect(result.recommendedRoles).toContain('USER')
  })

  it('ADMIN→VIEWER: HIGH risk', () => {
    // currentRoles: ADMIN(3), recommended: VIEWER(0) → rankDiff=3 ≥ 2
    ai.recordPattern({ userId: 'U001', resource: 'doc', action: 'READ', frequency: 3 })
    const result = ai.recommend('U001')
    expect(result.riskLevel).toBe('HIGH')
    expect(result.removeRoles).toContain('ADMIN')
  })

  it('미등록 사용자 에러', () => {
    expect(() => ai.recommend('UNKNOWN')).toThrow()
  })

  it('미등록 사용자 패턴 기록 에러', () => {
    expect(() => ai.recordPattern({ userId: 'UNKNOWN', resource: 'doc', action: 'READ', frequency: 1 })).toThrow()
  })

  it('권고 후 감사 로그', () => {
    ai.recommend('U001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'permission.recommend')).toBe(true)
  })
})
