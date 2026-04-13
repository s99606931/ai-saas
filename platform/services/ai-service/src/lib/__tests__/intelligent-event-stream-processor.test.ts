// Design Ref: §R412 — AI기반 지능형 이벤트 스트림 처리 최적화
import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentEventStreamProcessor } from '../intelligent-event-stream-processor'

describe('IntelligentEventStreamProcessor', () => {
  let processor: IntelligentEventStreamProcessor

  beforeEach(() => {
    processor = new IntelligentEventStreamProcessor()
  })

  it('HEALTHY: consumerLag <= lagThreshold', () => {
    processor.registerPartition({ partitionId: 'p1', topicId: 'topic-a', processedPerMin: 1000, consumerLag: 50, lagThreshold: 100 })
    const report = processor.analyze('topic-a')
    expect(report.partitions[0]?.status).toBe('HEALTHY')
    expect(report.overallStatus).toBe('OPTIMAL')
  })

  it('CONGESTED: consumerLag > lagThreshold → 스케일아웃 권고', () => {
    // 2개 파티션 중 1개만 CONGESTED → 절반 미만 → DEGRADED
    processor.registerPartition({ partitionId: 'p2a', topicId: 'topic-b', processedPerMin: 500, consumerLag: 200, lagThreshold: 100 })
    processor.registerPartition({ partitionId: 'p2b', topicId: 'topic-b', processedPerMin: 500, consumerLag: 50, lagThreshold: 100 })
    const report = processor.analyze('topic-b')
    expect(report.partitions.some((p) => p.status === 'CONGESTED')).toBe(true)
    expect(report.congestedPartitions).toBe(1)
    expect(report.overallStatus).toBe('DEGRADED')
  })

  it('IDLE: processedPerMin = 0', () => {
    processor.registerPartition({ partitionId: 'p3', topicId: 'topic-c', processedPerMin: 0, consumerLag: 0, lagThreshold: 100 })
    const report = processor.analyze('topic-c')
    expect(report.partitions[0]?.status).toBe('IDLE')
  })

  it('CRITICAL: 절반 이상 파티션 적체', () => {
    processor.registerPartition({ partitionId: 'p4', topicId: 'topic-d', processedPerMin: 100, consumerLag: 200, lagThreshold: 100 })
    processor.registerPartition({ partitionId: 'p5', topicId: 'topic-d', processedPerMin: 100, consumerLag: 200, lagThreshold: 100 })
    const report = processor.analyze('topic-d')
    expect(report.overallStatus).toBe('CRITICAL')
  })

  it('빈 토픽: 파티션 0개', () => {
    const report = processor.analyze('topic-empty')
    expect(report.totalPartitions).toBe(0)
    expect(report.overallStatus).toBe('OPTIMAL')
  })

  it('권고사항: 적체 시 파티션 증가 권고', () => {
    processor.registerPartition({ partitionId: 'p6', topicId: 'topic-e', processedPerMin: 300, consumerLag: 500, lagThreshold: 100 })
    const report = processor.analyze('topic-e')
    expect(report.recommendations.some((r) => r.includes('파티션'))).toBe(true)
  })

  it('감사 로그에 stream.analyze 기록', () => {
    processor.registerPartition({ partitionId: 'p7', topicId: 'topic-f', processedPerMin: 200, consumerLag: 10, lagThreshold: 100 })
    processor.analyze('topic-f')
    const logs = processor.getAuditLog()
    expect(logs.some((l) => l.action === 'stream.analyze')).toBe(true)
  })
})
