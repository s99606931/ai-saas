/**
 * Tests — SVC-AI-ADV-R159 Semantic Embedding Cache
 */

import { describe, it, expect } from 'vitest'
import { SemanticEmbeddingCache } from '../semantic-embedding-cache'

function makeCache(opts: { maxEntries?: number; ttlMs?: number } = {}) {
  let t = 1_700_000_000_000
  return {
    cache: new SemanticEmbeddingCache({
      maxEntries: opts.maxEntries,
      ttlMs: opts.ttlMs,
      now: () => {
        t += 1
        return t
      },
    }),
    tick(ms: number) {
      t += ms
    },
    getT: () => t,
  }
}

describe('SemanticEmbeddingCache', () => {
  it('동일 임베딩 저장 후 조회 시 hit', () => {
    const { cache } = makeCache()
    cache.set('tenant-a', [1, 0, 0], { answer: 'A' })
    const r = cache.get('tenant-a', [1, 0, 0])
    expect(r).not.toBeNull()
    expect((r!.value as { answer: string }).answer).toBe('A')
    expect(r!.similarity).toBeGreaterThan(0.99)
  })

  it('유사도 threshold 미만이면 miss', () => {
    const { cache } = makeCache()
    cache.set('tenant-a', [1, 0, 0], { answer: 'A' })
    const r = cache.get('tenant-a', [0, 1, 0])
    expect(r).toBeNull()
  })

  it('벡터 길이 불일치 시 vector_length_mismatch throw', () => {
    const { cache } = makeCache()
    cache.set('tenant-a', [1, 0, 0], { answer: 'A' })
    expect(() => cache.get('tenant-a', [1, 0])).toThrow('vector_length_mismatch')
  })

  it('maxEntries 초과 시 LRU 제거', () => {
    const { cache } = makeCache({ maxEntries: 2 })
    cache.set('tenant-a', [1, 0, 0], 'v1')
    cache.set('tenant-a', [0, 1, 0], 'v2')
    cache.set('tenant-a', [0, 0, 1], 'v3')
    const stats = cache.getStats()
    expect(stats.size).toBeLessThanOrEqual(2)
  })

  it('TTL 만료 후 조회 시 miss', () => {
    const ctx = makeCache({ ttlMs: 100 })
    ctx.cache.set('tenant-a', [1, 0, 0], 'v1')
    ctx.tick(500)
    const r = ctx.cache.get('tenant-a', [1, 0, 0])
    expect(r).toBeNull()
  })

  it('테넌트 A 의 데이터는 테넌트 B 에서 조회 불가', () => {
    const { cache } = makeCache()
    cache.set('tenant-a', [1, 0, 0], 'A-secret')
    const r = cache.get('tenant-b', [1, 0, 0])
    expect(r).toBeNull()
  })

  it('C/S 등급은 차단된다', () => {
    const { cache } = makeCache()
    expect(() => cache.set('tenant-a', [1, 0, 0], 'x', 'C')).toThrow('grade_blocked')
    expect(() => cache.set('tenant-a', [1, 0, 0], 'x', 'S')).toThrow('grade_blocked')
  })

  it('통계는 hits/misses 를 카운트한다', () => {
    const { cache } = makeCache()
    cache.set('tenant-a', [1, 0, 0], 'v1')
    cache.get('tenant-a', [1, 0, 0])
    cache.get('tenant-a', [0, 1, 0])
    const stats = cache.getStats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(1)
  })

  it('감사 로그가 set/hit/miss 를 기록한다', () => {
    const { cache } = makeCache()
    cache.set('tenant-a', [1, 0, 0], 'v1')
    cache.get('tenant-a', [1, 0, 0])
    const events = cache.getAuditLog().map((l) => l.event)
    expect(events).toContain('set')
    expect(events).toContain('hit')
  })

  it('invalid tenant 거부', () => {
    const { cache } = makeCache()
    expect(() => cache.set('', [1, 0, 0], 'v')).toThrow('invalid_tenant')
  })
})
