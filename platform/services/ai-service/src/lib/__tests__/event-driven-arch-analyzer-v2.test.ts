// Plan SC: SVC-AI-ADV-R465-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { EventDrivenArchAnalyzerV2 } from '../event-driven-arch-analyzer-v2'

describe('EventDrivenArchAnalyzerV2', () => {
  let analyzer: EventDrivenArchAnalyzerV2

  beforeEach(() => {
    analyzer = new EventDrivenArchAnalyzerV2()
  })

  it('토픽 없을 때 → HEALTHY, issues=0', () => {
    const result = analyzer.analyze()
    expect(result.healthStatus).toBe('HEALTHY')
    expect(result.issues).toHaveLength(0)
    expect(result.totalTopics).toBe(0)
  })

  it('정상 토픽 (프로듀서+소비자 모두 존재) → HEALTHY', () => {
    analyzer.registerTopic({ topicId: 'T1', name: '주문 이벤트', eventType: 'DOMAIN_EVENT', producers: ['SVC-A'], consumers: ['SVC-B'], avgLagMessages: 10, messagesPerSecond: 100 })
    const result = analyzer.analyze()
    expect(result.healthStatus).toBe('HEALTHY')
  })

  it('소비자 없는 토픽 → ORPHAN_PRODUCER 이슈, orphanProducers 포함', () => {
    analyzer.registerTopic({ topicId: 'T-ORPHAN', name: '고아 토픽', eventType: 'DOMAIN_EVENT', producers: ['SVC-ORPHAN'], consumers: [], avgLagMessages: 0, messagesPerSecond: 10 })
    const result = analyzer.analyze()
    expect(result.issues.some((i) => i.type === 'ORPHAN_PRODUCER')).toBe(true)
    expect(result.orphanProducers).toContain('SVC-ORPHAN')
  })

  it('MPS 1000 이상 → OVERLOADED_TOPIC 이슈, overloadedTopics 포함', () => {
    analyzer.registerTopic({ topicId: 'T-OVER', name: '과부하 토픽', eventType: 'INTEGRATION_EVENT', producers: ['SVC-X'], consumers: ['SVC-Y'], avgLagMessages: 100, messagesPerSecond: 1500 })
    const result = analyzer.analyze()
    expect(result.issues.some((i) => i.type === 'OVERLOADED_TOPIC')).toBe(true)
    expect(result.overloadedTopics).toContain('T-OVER')
  })

  it('랙 5000 이상 → HIGH_LAG CRITICAL 이슈, healthStatus=CRITICAL', () => {
    analyzer.registerTopic({ topicId: 'T-LAG', name: '랙 토픽', eventType: 'DOMAIN_EVENT', producers: ['SVC-P'], consumers: ['SVC-C'], avgLagMessages: 6000, messagesPerSecond: 50 })
    const result = analyzer.analyze()
    expect(result.issues.some((i) => i.type === 'HIGH_LAG' && i.severity === 'CRITICAL')).toBe(true)
    expect(result.healthStatus).toBe('CRITICAL')
  })

  it('A→B→A 순환 의존 → EVENT_LOOP CRITICAL 이슈', () => {
    analyzer.registerTopic({ topicId: 'T-AB', name: 'A to B', eventType: 'DOMAIN_EVENT', producers: ['SVC-A'], consumers: ['SVC-B'], avgLagMessages: 0, messagesPerSecond: 10 })
    analyzer.registerTopic({ topicId: 'T-BA', name: 'B to A', eventType: 'DOMAIN_EVENT', producers: ['SVC-B'], consumers: ['SVC-A'], avgLagMessages: 0, messagesPerSecond: 10 })
    const result = analyzer.analyze()
    expect(result.issues.some((i) => i.type === 'EVENT_LOOP' && i.severity === 'CRITICAL')).toBe(true)
  })

  it('HIGH 이슈만 있을 때 → DEGRADED', () => {
    analyzer.registerTopic({ topicId: 'T-H', name: '고아 HIGH', eventType: 'DOMAIN_EVENT', producers: ['SVC-Z'], consumers: [], avgLagMessages: 0, messagesPerSecond: 10 })
    const result = analyzer.analyze()
    expect(result.healthStatus).toBe('DEGRADED')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    analyzer.registerTopic({ topicId: 'T1', name: '테스트', eventType: 'COMMAND', producers: ['P1'], consumers: ['C1'], avgLagMessages: 0, messagesPerSecond: 5 })
    analyzer.analyze()
    const log1 = analyzer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', topicId: 'X', detail: {} })
    const log2 = analyzer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
