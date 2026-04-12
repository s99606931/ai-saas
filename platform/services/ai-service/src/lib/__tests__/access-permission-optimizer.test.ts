/**
 * AI 기반 접근 권한 자동 최적화 단위 테스트 — SVC-AI-ADV-R184
 * Plan SC: FR-R184.1 ~ FR-R184.5
 */

import { describe, it, expect } from 'vitest'
import { AccessPermissionOptimizer, DataGrade } from '../access-permission-optimizer'

describe('AccessPermissionOptimizer — R184', () => {
  it('FR-R184.1: 사용자 권한 등록 및 audit log', () => {
    const apo = new AccessPermissionOptimizer(DataGrade.O)
    apo.registerUser({ userId: 'user1', permissions: ['read', 'write', 'delete', 'admin'] })
    const log = apo.getAuditLog()
    expect(log[0]?.action).toBe('userRegistered')
    expect(log[0]?.details.userId).toBe('user1')
  })

  it('FR-R184.2: 권한 사용 이벤트 기록', () => {
    const apo = new AccessPermissionOptimizer(DataGrade.O)
    apo.registerUser({ userId: 'u1', permissions: ['read', 'write'] })
    apo.recordUsage({ userId: 'u1', permission: 'read', usedAt: Date.now() })
    const log = apo.getAuditLog()
    expect(log.some((e) => e.action === 'usageRecorded')).toBe(true)
  })

  it('FR-R184.3: 미사용 권한 탐지', () => {
    const apo = new AccessPermissionOptimizer(DataGrade.O)
    const since = Date.now() - 1000
    apo.registerUser({ userId: 'u1', permissions: ['read', 'write', 'delete'] })
    apo.recordUsage({ userId: 'u1', permission: 'read', usedAt: Date.now() })
    const analysis = apo.analyzeUser('u1', since)
    expect(analysis.unusedPermissions).toContain('write')
    expect(analysis.unusedPermissions).toContain('delete')
    expect(analysis.usedPermissions).toContain('read')
  })

  it('FR-R184.4: 최소 권한 세트 = 사용된 권한만', () => {
    const apo = new AccessPermissionOptimizer(DataGrade.O)
    const since = 0
    apo.registerUser({ userId: 'u1', permissions: ['read', 'write', 'admin'] })
    apo.recordUsage({ userId: 'u1', permission: 'read', usedAt: 1000 })
    const analysis = apo.analyzeUser('u1', since)
    expect(analysis.minimumPermissionSet).toEqual(['read'])
  })

  it('FR-R184.4: riskLevel high — 미사용 5개 이상', () => {
    const apo = new AccessPermissionOptimizer(DataGrade.O)
    const perms = ['read', 'write', 'delete', 'admin', 'export', 'import']
    apo.registerUser({ userId: 'u1', permissions: perms })
    const analysis = apo.analyzeUser('u1', Date.now())
    expect(analysis.riskLevel).toBe('high')
    expect(analysis.recommendations.length).toBeGreaterThan(0)
  })

  it('FR-R184.5: audit log append-only', () => {
    const apo = new AccessPermissionOptimizer(DataGrade.O)
    apo.registerUser({ userId: 'u1', permissions: ['read'] })
    const log1 = apo.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(apo.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new AccessPermissionOptimizer(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new AccessPermissionOptimizer(DataGrade.S)).toThrow('BLOCKED')
  })

  it('미등록 사용자 usage 기록 throw', () => {
    const apo = new AccessPermissionOptimizer(DataGrade.O)
    expect(() => apo.recordUsage({ userId: 'unknown', permission: 'read', usedAt: 0 }))
      .toThrow('unknown user')
  })
})
