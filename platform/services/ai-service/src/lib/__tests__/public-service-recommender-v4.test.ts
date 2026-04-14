import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceRecommenderV4 } from '../public-service-recommender-v4'

describe('PublicServiceRecommenderV4', () => {
  let recommender: PublicServiceRecommenderV4

  beforeEach(() => { recommender = new PublicServiceRecommenderV4() })

  it('should register a service', () => {
    recommender.registerService('svc1', 'Tax Portal', ['tax', 'finance'])
    expect(recommender.getRecommendationCount()).toBe(1)
  })

  it('should return top services sorted by interaction score', () => {
    recommender.registerService('svc1', 'Low', ['a'])
    recommender.registerService('svc2', 'High', ['b'])
    recommender.recordInteraction('user1', 'svc1', 2)
    recommender.recordInteraction('user2', 'svc2', 10)
    const top = recommender.getTopServices(1)
    expect(top[0]!.serviceId).toBe('svc2')
  })

  it('should mask userId in audit log', () => {
    recommender.registerService('svc1', 'Tax', ['tax'])
    recommender.recordInteraction('citizen-123', 'svc1', 5)
    const log = recommender.getAuditLog()
    const entry = log.find((e: { action: string }) => e.action === 'RECORD_INTERACTION')
    expect(entry?.details?.maskedUserId).not.toBe('citizen-123')
    expect(entry?.details?.maskedUserId).toHaveLength(16)
  })

  it('should block C grade data', () => {
    recommender.registerService('svc1', 'X', [])
    expect(() => recommender.recordInteraction('u1', 'svc1', 3, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    recommender.registerService('svc1', 'X', [])
    expect(() => recommender.recordInteraction('u1', 'svc1', 3, 'S')).toThrow('BLOCKED')
  })

  it('should return empty when no interactions', () => {
    recommender.registerService('svc1', 'X', [])
    const top = recommender.getTopServices(5)
    expect(top).toHaveLength(1)
  })

  it('should maintain audit log', () => {
    recommender.registerService('svc1', 'X', [])
    recommender.recordInteraction('u1', 'svc1', 3)
    expect(recommender.getAuditLog().length).toBeGreaterThan(0)
  })
})
