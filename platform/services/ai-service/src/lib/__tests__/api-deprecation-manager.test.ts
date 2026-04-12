/**
 * Unit tests for API Deprecation Manager — SVC-AI-ADV-R103
 */

import { describe, it, expect } from 'vitest'
import { ApiDeprecationManager } from '../api-deprecation-manager'

describe('SVC-AI-ADV-R103 ApiDeprecationManager', () => {
  it('[FR-R103.1] registers version and checks ACTIVE', () => {
    const m = new ApiDeprecationManager()
    m.registerVersion({ apiId: 'users', version: 'v1', status: 'ACTIVE' })
    const check = m.checkVersion('users', 'v1')
    expect(check.allowed).toBe(true)
    expect(check.status).toBe('ACTIVE')
  })

  it('[FR-R103.4] DEPRECATED injects headers', () => {
    const m = new ApiDeprecationManager()
    m.registerVersion({
      apiId: 'users',
      version: 'v1',
      status: 'DEPRECATED',
      sunsetDate: '2026-12-31T00:00:00Z',
      successor: '/v2/users',
    })
    const check = m.checkVersion('users', 'v1')
    expect(check.allowed).toBe(true)
    expect(check.headers.Deprecation).toBe('true')
    expect(check.headers.Sunset).toBeDefined()
    expect(check.headers.Link).toContain('successor-version')
  })

  it('[FR-R103.3] SUNSET blocks request', () => {
    const m = new ApiDeprecationManager()
    m.registerVersion({ apiId: 'users', version: 'v0', status: 'SUNSET' })
    const check = m.checkVersion('users', 'v0')
    expect(check.allowed).toBe(false)
    expect(check.status).toBe('SUNSET')
  })

  it('[FR-R103.3] unknown version denied', () => {
    const m = new ApiDeprecationManager()
    const check = m.checkVersion('users', 'v99')
    expect(check.allowed).toBe(false)
    expect(check.status).toBe('UNKNOWN')
  })

  it('[FR-R103.5] upcomingSunsets filters within window', () => {
    const m = new ApiDeprecationManager()
    const now = new Date('2026-04-12T00:00:00Z')
    m.registerVersion({
      apiId: 'a',
      version: 'v1',
      status: 'DEPRECATED',
      sunsetDate: '2026-04-25T00:00:00Z', // within 30d
    })
    m.registerVersion({
      apiId: 'b',
      version: 'v1',
      status: 'DEPRECATED',
      sunsetDate: '2026-07-30T00:00:00Z', // outside 30d
    })
    const upcoming = m.upcomingSunsets(30, now)
    expect(upcoming).toHaveLength(1)
    expect(upcoming[0]!.apiId).toBe('a')
  })

  it('[FR-R103.2] updateStatus changes version state', () => {
    const m = new ApiDeprecationManager()
    m.registerVersion({ apiId: 'a', version: 'v1', status: 'ACTIVE' })
    m.updateStatus('a', 'v1', 'DEPRECATED', '2026-10-01T00:00:00Z')
    const check = m.checkVersion('a', 'v1')
    expect(check.status).toBe('DEPRECATED')
    expect(check.headers.Sunset).toBe('2026-10-01T00:00:00Z')
  })

  it('[FR-R103.2] updateStatus on unknown throws', () => {
    const m = new ApiDeprecationManager()
    expect(() => m.updateStatus('x', 'v1', 'SUNSET')).toThrow(/not found/)
  })
})
