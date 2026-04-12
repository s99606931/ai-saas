/**
 * Unit tests for Adaptive Rate Limiter — SVC-AI-ADV-R94
 */

import { describe, it, expect, vi } from 'vitest'
import {
  AdaptiveRateLimiter,
  type AuditSink,
} from '../adaptive-rate-limiter'

describe('SVC-AI-ADV-R94 AdaptiveRateLimiter', () => {
  it('[FR-R94.4] allows requests below base limit', () => {
    const limiter = new AdaptiveRateLimiter({ baseRps: 10, now: () => 1000 })
    for (let i = 0; i < 5; i++) {
      expect(
        limiter.decide({ tenantId: 't1', priority: 'HIGH', timestamp: 1000 }),
      ).toBe('ALLOW')
    }
  })

  it('[FR-R94.4] denies LOW priority when at limit', () => {
    const limiter = new AdaptiveRateLimiter({ baseRps: 2, now: () => 1000 })
    // LOW effective = floor(2 * 0.5) = 1
    expect(
      limiter.decide({ tenantId: 't1', priority: 'LOW', timestamp: 1000 }),
    ).toBe('ALLOW')
    expect(
      limiter.decide({ tenantId: 't1', priority: 'LOW', timestamp: 1000 }),
    ).toBe('DENY')
  })

  it('[FR-R94.4] throttles HIGH priority when saturated', () => {
    const limiter = new AdaptiveRateLimiter({ baseRps: 2, now: () => 1000 })
    limiter.decide({ tenantId: 't1', priority: 'HIGH', timestamp: 1000 })
    limiter.decide({ tenantId: 't1', priority: 'HIGH', timestamp: 1000 })
    // Third HIGH exceeds base=2 → throttle
    expect(
      limiter.decide({ tenantId: 't1', priority: 'HIGH', timestamp: 1000 }),
    ).toBe('THROTTLE')
  })

  it('[FR-R94.3] tenant isolation — A saturation does not affect B', () => {
    const limiter = new AdaptiveRateLimiter({ baseRps: 2, now: () => 1000 })
    // saturate t1
    limiter.decide({ tenantId: 't1', priority: 'LOW', timestamp: 1000 })
    limiter.decide({ tenantId: 't1', priority: 'LOW', timestamp: 1000 })
    // t2 still fresh
    expect(
      limiter.decide({ tenantId: 't2', priority: 'HIGH', timestamp: 1000 }),
    ).toBe('ALLOW')
  })

  it('[FR-R94.1] EWMA tracks allowed traffic across windows', () => {
    const limiter = new AdaptiveRateLimiter({
      baseRps: 5,
      alpha: 0.5,
      windowMs: 1000,
      maxMultiplier: 10,
    })
    // window 1: 5 HIGH allowed (fills base), rest throttled
    for (let i = 0; i < 10; i++) {
      limiter.decide({ tenantId: 't1', priority: 'HIGH', timestamp: 1000 })
    }
    // window 2: roll triggered; EWMA = 0.5*5 + 0.5*5 = 5 (stays at base)
    limiter.decide({ tenantId: 't1', priority: 'HIGH', timestamp: 2500 })
    const stats = limiter.snapshot('t1')
    expect(stats.ewmaRps).toBeGreaterThanOrEqual(5)
    expect(stats.dynamicLimit).toBeGreaterThanOrEqual(5)
  })

  it('[FR-R94.3] snapshot returns correct counts', () => {
    const limiter = new AdaptiveRateLimiter({ baseRps: 2, now: () => 1000 })
    limiter.decide({ tenantId: 't1', priority: 'HIGH', timestamp: 1000 })
    limiter.decide({ tenantId: 't1', priority: 'LOW', timestamp: 1000 })
    limiter.decide({ tenantId: 't1', priority: 'LOW', timestamp: 1000 })
    const stats = limiter.snapshot('t1')
    expect(stats.allowedCount).toBeGreaterThan(0)
    expect(stats.deniedCount).toBeGreaterThan(0)
  })

  it('[FR-R94.5] emitAudit records all tenants', async () => {
    const limiter = new AdaptiveRateLimiter({ baseRps: 2, now: () => 1000 })
    limiter.decide({ tenantId: 't1', priority: 'HIGH', timestamp: 1000 })
    limiter.decide({ tenantId: 't2', priority: 'HIGH', timestamp: 1000 })
    const audit: AuditSink = { log: vi.fn().mockResolvedValue(undefined) }
    await limiter.emitAudit(audit)
    expect(audit.log).toHaveBeenCalledTimes(2)
  })
})
