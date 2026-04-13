import { describe, it, expect, beforeEach } from 'vitest'
import { EventDrivenArchAnalyzerAi, type EventTopic } from '../event-driven-arch-analyzer-ai'

describe('EventDrivenArchAnalyzerAi', () => {
  let ai: EventDrivenArchAnalyzerAi

  const topic: EventTopic = {
    topicId: 'TOPIC001',
    name: '민원 이벤트',
    producerServiceIds: ['SVC-A'],
    consumerServiceIds: ['SVC-B'],
    avgMessageSizeKb: 2,
    messagesPerSecond: 100,
    retentionDays: 7,
  }

  beforeEach(() => {
    ai = new EventDrivenArchAnalyzerAi()
    ai.registerTopic(topic)
  })

  it('토픽 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'topic.register')).toBe(true)
  })

  it('메트릭 없으면 HEALTHY', () => {
    const report = ai.analyze()
    expect(report.topicAnalyses[0]?.healthStatus).toBe('HEALTHY')
  })

  it('lag > 10000 → CRITICAL', () => {
    ai.recordMetric({ topicId: 'TOPIC001', timestamp: Date.now(), publishRate: 100, consumeRate: 10, lagMessages: 15000, errorRate: 0 })
    const report = ai.analyze()
    expect(report.topicAnalyses[0]?.lagStatus).toBe('CRITICAL')
    expect(report.topicAnalyses[0]?.healthStatus).toBe('CRITICAL')
  })

  it('lag 1000~10000 → WARNING', () => {
    ai.recordMetric({ topicId: 'TOPIC001', timestamp: Date.now(), publishRate: 100, consumeRate: 50, lagMessages: 5000, errorRate: 0 })
    const report = ai.analyze()
    expect(report.topicAnalyses[0]?.lagStatus).toBe('WARNING')
  })

  it('에러율 > 5% → CRITICAL healthStatus', () => {
    ai.recordMetric({ topicId: 'TOPIC001', timestamp: Date.now(), publishRate: 100, consumeRate: 100, lagMessages: 0, errorRate: 0.08 })
    const report = ai.analyze()
    expect(report.topicAnalyses[0]?.healthStatus).toBe('CRITICAL')
  })

  it('컨슈머 없는 토픽 → DEGRADED + 권고사항', () => {
    ai.registerTopic({ ...topic, topicId: 'TOPIC002', consumerServiceIds: [] })
    const report = ai.analyze()
    const t2 = report.topicAnalyses.find((t) => t.topicId === 'TOPIC002')!
    expect(t2.healthStatus).toBe('DEGRADED')
    expect(t2.recommendations.some((r) => r.includes('컨슈머'))).toBe(true)
  })

  it('미등록 토픽 메트릭 에러', () => {
    expect(() => ai.recordMetric({ topicId: 'UNKNOWN', timestamp: Date.now(), publishRate: 0, consumeRate: 0, lagMessages: 0, errorRate: 0 })).toThrow()
  })

  it('분석 후 감사 로그', () => {
    ai.analyze()
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'arch.analyze')).toBe(true)
  })
})
