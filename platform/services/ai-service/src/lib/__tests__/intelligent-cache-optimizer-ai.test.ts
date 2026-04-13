import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentCacheOptimizerAi, type CacheConfig, type CacheMetric } from '../intelligent-cache-optimizer-ai'

describe('IntelligentCacheOptimizerAi', () => {
  let optimizer: IntelligentCacheOptimizerAi

  const config: CacheConfig = {
    cacheId: 'CACHE001',
    name: '민원 데이터 캐시',
    currentStrategy: 'LRU',
    maxSizeMb: 1000,
    defaultTtlSeconds: 300,
  }

  const makeMetric = (hits: number, misses: number, evictions: number, usedMb: number): CacheMetric => ({
    cacheId: 'CACHE001',
    timestamp: Date.now(),
    hitCount: hits,
    missCount: misses,
    evictionCount: evictions,
    usedSizeMb: usedMb,
  })

  beforeEach(() => {
    optimizer = new IntelligentCacheOptimizerAi()
    optimizer.registerCache(config)
  })

  it('캐시 등록 감사 로그', () => {
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'cache.register')).toBe(true)
  })

  it('메트릭 없으면 NO_CHANGE', () => {
    const result = optimizer.optimize('CACHE001')
    expect(result.action).toBe('NO_CHANGE')
  })

  it('낮은 히트율 LRU → LFU 전략 변경', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(10, 100, 5, 500))
    // hitRate = 10/110 ≈ 9% < 50%, strategy LRU → CHANGE_STRATEGY to LFU
    const result = optimizer.optimize('CACHE001')
    expect(result.action).toBe('CHANGE_STRATEGY')
    expect(result.recommendedStrategy).toBe('LFU')
  })

  it('높은 축출률 + 용량 포화 → INCREASE_SIZE', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(50, 50, 40, 950))
    // evictionRate = 40/100 = 40% > 30%, sizeUtil = 950/1000 = 95% > 90%
    const result = optimizer.optimize('CACHE001')
    expect(result.action).toBe('INCREASE_SIZE')
    expect(result.recommendedSizeMb).toBeGreaterThan(1000)
  })

  it('높은 히트율 + 낮은 사용률 → DECREASE_TTL', () => {
    for (let i = 0; i < 5; i++) optimizer.recordMetric(makeMetric(950, 50, 2, 200))
    // hitRate = 950/1000 = 95% > 90%, sizeUtil = 200/1000 = 20% < 30%
    const result = optimizer.optimize('CACHE001')
    expect(result.action).toBe('DECREASE_TTL')
    expect(result.recommendedTtlSeconds).toBeLessThan(300)
  })

  it('미등록 캐시 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('미등록 캐시 메트릭 기록 에러', () => {
    expect(() => optimizer.recordMetric({ ...makeMetric(10, 5, 1, 100), cacheId: 'UNKNOWN' })).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.recordMetric(makeMetric(50, 50, 5, 500))
    optimizer.optimize('CACHE001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'cache.optimize')).toBe(true)
  })
})
