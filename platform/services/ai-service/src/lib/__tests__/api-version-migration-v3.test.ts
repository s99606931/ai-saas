import { describe, it, expect, beforeEach } from 'vitest'
import { ApiVersionMigrationV3 } from '../api-version-migration-v3'

describe('ApiVersionMigrationV3', () => {
  let svc: ApiVersionMigrationV3

  beforeEach(() => {
    svc = new ApiVersionMigrationV3()
  })

  it('returns empty plan when no endpoints match from-version', () => {
    svc.registerEndpoint({ path: '/users', method: 'GET', version: 'v2', deprecated: false })
    const plans = svc.planMigration('v1', 'v2')
    expect(plans).toHaveLength(0)
  })

  it('marks deprecated endpoint as HIGH priority', () => {
    svc.registerEndpoint({ path: '/users', method: 'GET', version: 'v1', deprecated: true })
    const plans = svc.planMigration('v1', 'v2')
    expect(plans[0]?.priority).toBe('HIGH')
  })

  it('marks breaking-change migration as MEDIUM priority', () => {
    svc.registerEndpoint({ path: '/users', method: 'POST', version: 'v1', deprecated: false })
    const plans = svc.planMigration('v1', 'v2', ['response format change'])
    expect(plans[0]?.priority).toBe('MEDIUM')
    expect(plans[0]?.breakingChanges).toContain('response format change')
  })

  it('marks trivial migration as LOW priority', () => {
    svc.registerEndpoint({ path: '/health', method: 'GET', version: 'v1', deprecated: false })
    const plans = svc.planMigration('v1', 'v2')
    expect(plans[0]?.priority).toBe('LOW')
  })

  it('blocks C/S grade during registration', () => {
    expect(() =>
      svc.registerEndpoint({ path: '/x', method: 'GET', version: 'v1', deprecated: false }, 'C'),
    ).toThrow('BLOCKED')
  })

  it('records PLAN_MIGRATION in audit log', () => {
    svc.registerEndpoint({ path: '/a', method: 'GET', version: 'v1', deprecated: false })
    svc.planMigration('v1', 'v2')
    expect(svc.getAuditLog().some((e) => e.action === 'PLAN_MIGRATION')).toBe(true)
  })
})
