// Plan SC: SVC-AI-ADV-R343
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceTierClassifierAI } from '../service-tier-classifier-ai'

describe('ServiceTierClassifierAI', () => {
  let classifier: ServiceTierClassifierAI

  beforeEach(() => {
    classifier = new ServiceTierClassifierAI()
  })

  it('registerService — 감사 로그에 service.register 기록', () => {
    classifier.registerService('svc-1', '민원포털')
    const log = classifier.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('service.register')
  })

  it('classifyTier — 가용성 99.9% 이상 → platinum', () => {
    classifier.registerService('svc-1', '민원포털')
    classifier.recordMetrics('svc-1', 99.95, 100, 1000)
    const result = classifier.classifyTier('svc-1')
    expect(result.tier).toBe('platinum')
    expect(result.tierScore).toBe(4)
  })

  it('classifyTier — 가용성 99.5% ~ 99.9% → gold', () => {
    classifier.registerService('svc-1', '민원포털')
    classifier.recordMetrics('svc-1', 99.7, 100, 1000)
    const result = classifier.classifyTier('svc-1')
    expect(result.tier).toBe('gold')
    expect(result.tierScore).toBe(3)
  })

  it('classifyTier — 가용성 99.0% ~ 99.5% → silver', () => {
    classifier.registerService('svc-1', '민원포털')
    classifier.recordMetrics('svc-1', 99.2, 150, 800)
    const result = classifier.classifyTier('svc-1')
    expect(result.tier).toBe('silver')
    expect(result.tierScore).toBe(2)
  })

  it('classifyTier — 가용성 99.0% 미만 → bronze', () => {
    classifier.registerService('svc-1', '민원포털')
    classifier.recordMetrics('svc-1', 98.5, 300, 500)
    const result = classifier.classifyTier('svc-1')
    expect(result.tier).toBe('bronze')
    expect(result.tierScore).toBe(1)
  })

  it('getTierSummary — tier별 서비스 집계', () => {
    classifier.registerService('svc-1', '민원포털')
    classifier.registerService('svc-2', '결제시스템')
    classifier.recordMetrics('svc-1', 99.95, 100, 1000) // platinum
    classifier.recordMetrics('svc-2', 99.7, 120, 900) // gold
    const summary = classifier.getTierSummary()
    const tiers = summary.map((s) => s.tier)
    expect(tiers).toContain('platinum')
    expect(tiers).toContain('gold')
  })

  it('recordMetrics — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    classifier.registerService('svc-1', '민원포털')
    expect(() => classifier.recordMetrics('svc-1', 99.9, 100, 1000, 'C')).toThrow('BLOCKED')
  })

  it('recordMetrics — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    classifier.registerService('svc-1', '민원포털')
    expect(() => classifier.recordMetrics('svc-1', 99.9, 100, 1000, 'S')).toThrow('N2SF N-05')
  })
})
