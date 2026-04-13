import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceAccelerationCacheAi, type CachePolicy } from '../service-acceleration-cache-ai'

describe('ServiceAccelerationCacheAi', () => {
  let cache: ServiceAccelerationCacheAi

  const policy: CachePolicy = {
    cacheId: 'CACHE001',
    serviceId: 'SVC001',
    routePattern: '/api/v1/public/*',
    ttlSeconds: 300,
    maxEntries: 100,
    dataGrade: 'O',
  }

  beforeEach(() => {
    cache = new ServiceAccelerationCacheAi()
    cache.registerPolicy(policy)
  })

  it('C/S 등급 캐시 정책 차단', () => {
    expect(() => cache.registerPolicy({ ...policy, cacheId: 'C_CACHE', dataGrade: 'C' })).toThrow('BLOCKED')
    expect(() => cache.registerPolicy({ ...policy, cacheId: 'S_CACHE', dataGrade: 'S' })).toThrow('BLOCKED')
  })

  it('SET 후 GET → HIT', () => {
    cache.access({ cacheId: 'CACHE001', key: 'key1', method: 'SET', value: 'value1' })
    const result = cache.access({ cacheId: 'CACHE001', key: 'key1', method: 'GET' })
    expect(result.result).toBe('HIT')
    expect(result.value).toBe('value1')
  })

  it('존재하지 않는 키 GET → MISS', () => {
    const result = cache.access({ cacheId: 'CACHE001', key: 'nonexistent', method: 'GET' })
    expect(result.result).toBe('MISS')
  })

  it('INVALIDATE 후 GET → MISS', () => {
    cache.access({ cacheId: 'CACHE001', key: 'key2', method: 'SET', value: 'value2' })
    cache.access({ cacheId: 'CACHE001', key: 'key2', method: 'INVALIDATE' })
    const result = cache.access({ cacheId: 'CACHE001', key: 'key2', method: 'GET' })
    expect(result.result).toBe('MISS')
  })

  it('hitRate 계산 — SET 후 HIT', () => {
    cache.access({ cacheId: 'CACHE001', key: 'k', method: 'SET', value: 'v' })
    const hit = cache.access({ cacheId: 'CACHE001', key: 'k', method: 'GET' })
    expect(hit.hitRate).toBeGreaterThan(0)
  })

  it('미등록 캐시 에러', () => {
    expect(() => cache.access({ cacheId: 'UNKNOWN', key: 'k', method: 'GET' })).toThrow()
  })

  it('캐시 접근 후 감사 로그', () => {
    cache.access({ cacheId: 'CACHE001', key: 'k', method: 'SET', value: 'v' })
    const log = cache.getAuditLog()
    expect(log.some((e) => e.action === 'cache.set')).toBe(true)
  })
})
