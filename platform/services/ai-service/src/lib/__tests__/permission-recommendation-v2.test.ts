import { describe, it, expect, beforeEach } from 'vitest'
import { PermissionRecommendationV2 } from '../permission-recommendation-v2'

describe('PermissionRecommendationV2', () => {
  let recommender: PermissionRecommendationV2

  beforeEach(() => { recommender = new PermissionRecommendationV2() })

  it('should register a role', () => {
    recommender.registerRole('r1', 'Admin', ['read', 'write', 'delete'])
    expect(recommender.getAuditLog().length).toBeGreaterThan(0)
  })

  it('should return null when no access recorded', () => {
    recommender.registerRole('r1', 'Viewer', ['read'])
    expect(recommender.recommendRole('user-1')).toBeNull()
  })

  it('should recommend matching role based on top resource', () => {
    recommender.registerRole('r1', 'Viewer', ['read'])
    recommender.recordAccess('user-1', 'read')
    recommender.recordAccess('user-1', 'read')
    expect(recommender.recommendRole('user-1')).toBe('r1')
  })

  it('should block C grade data', () => {
    expect(() => recommender.recordAccess('user-1', 'read', 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    expect(() => recommender.recordAccess('user-1', 'read', 'S')).toThrow('BLOCKED')
  })

  it('should mask userId in audit log', () => {
    recommender.recordAccess('user-abc', 'read')
    const log = recommender.getAuditLog()
    const entry = log.find((e: { action: string }) => e.action === 'RECORD_ACCESS')
    expect(entry?.details?.maskedUserId).not.toBe('user-abc')
    expect(entry?.details?.maskedUserId).toHaveLength(16)
  })

  it('should maintain audit log', () => {
    recommender.registerRole('r1', 'Admin', ['write'])
    recommender.recordAccess('u1', 'write')
    expect(recommender.getAuditLog().length).toBeGreaterThan(0)
  })
})
