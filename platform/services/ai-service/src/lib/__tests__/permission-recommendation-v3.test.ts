import { describe, it, expect, beforeEach } from 'vitest'
import { PermissionRecommendationV3 } from '../permission-recommendation-v3'

describe('PermissionRecommendationV3', () => {
  let rec: PermissionRecommendationV3

  beforeEach(() => {
    rec = new PermissionRecommendationV3()
  })

  it('registers a role and logs it', () => {
    rec.registerRole('viewer', 'Viewer', ['read'])
    const log = rec.getAuditLog()
    expect(log.some((e) => e.action === 'REGISTER_ROLE')).toBe(true)
  })

  it('returns null recommendation when user has no access', () => {
    rec.registerRole('admin', 'Admin', ['read', 'write'])
    const result = rec.recommend('user-1')
    expect(result.recommendedRoleId).toBeNull()
  })

  it('recommends role with best match and least excess (least privilege)', () => {
    rec.registerRole('viewer', 'Viewer', ['read'])
    rec.registerRole('admin', 'Admin', ['read', 'write', 'delete'])
    rec.recordAccess('user-1', 'read')
    const result = rec.recommend('user-1')
    expect(result.recommendedRoleId).toBe('viewer')
  })

  it('blocks C grade data transmission', () => {
    expect(() => rec.recordAccess('u', 'read', 'C')).toThrow('BLOCKED')
  })

  it('blocks S grade data transmission', () => {
    expect(() => rec.recordAccess('u', 'read', 'S')).toThrow('BLOCKED')
  })

  it('masks userId (16 hex chars) in audit log', () => {
    rec.recordAccess('alice@example.com', 'read')
    const entry = rec.getAuditLog().find((e) => e.action === 'RECORD_ACCESS')
    expect(entry?.details?.maskedUserId).not.toBe('alice@example.com')
    expect(String(entry?.details?.maskedUserId)).toHaveLength(16)
  })
})
