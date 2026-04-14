// Plan SC: SVC-AI-ADV-R588-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { StreamingDataOptimizerV2, type StreamDefinition, type StreamMetrics } from '../streaming-data-optimizer-v2'

describe('StreamingDataOptimizerV2', () => {
  let optimizer: StreamingDataOptimizerV2

  const stream: StreamDefinition = {
    streamId: 'STR-1', name: '민원 이벤트 스트림',
    topicName: 'complaint-events', partitionCount: 4,
    consumerCount: 2, expectedThroughputPerSec: 1000,
  }

  const healthyMetrics: StreamMetrics = {
    streamId: 'STR-1', currentThroughputPerSec: 950,
    avgLagMs: 100, errorRatePct: 0.5, partitionUtilization: [50, 55, 48, 52],
  }

  beforeEach(() => {
    optimizer = new StreamingDataOptimizerV2()
  })

  it('스트림 없을 때 → 이슈 없음', () => {
    const issues = optimizer.analyze()
    expect(issues).toHaveLength(0)
  })

  it('정상 메트릭 → 이슈 없음', () => {
    optimizer.registerStream(stream)
    optimizer.ingestMetrics(healthyMetrics)
    const issues = optimizer.analyze()
    expect(issues).toHaveLength(0)
  })

  it('처리량 70% 미달 → BOTTLENECK CRITICAL 이슈', () => {
    optimizer.registerStream(stream)
    optimizer.ingestMetrics({ ...healthyMetrics, currentThroughputPerSec: 400 })
    const issues = optimizer.analyze()
    expect(issues.some((i) => i.issueType === 'BOTTLENECK' && i.severity === 'CRITICAL')).toBe(true)
  })

  it('지연 500ms 초과 → HIGH_LAG HIGH 이슈', () => {
    optimizer.registerStream(stream)
    optimizer.ingestMetrics({ ...healthyMetrics, avgLagMs: 800 })
    const issues = optimizer.analyze()
    expect(issues.some((i) => i.issueType === 'HIGH_LAG' && i.severity === 'HIGH')).toBe(true)
  })

  it('파티션 불균형 40% 이상 → PARTITION_IMBALANCE 이슈', () => {
    optimizer.registerStream(stream)
    optimizer.ingestMetrics({ ...healthyMetrics, partitionUtilization: [10, 20, 60, 90] })
    const issues = optimizer.analyze()
    expect(issues.some((i) => i.issueType === 'PARTITION_IMBALANCE')).toBe(true)
  })

  it('BOTTLENECK → INCREASE_PARTITIONS 최적화 권고', () => {
    optimizer.registerStream(stream)
    optimizer.ingestMetrics({ ...healthyMetrics, currentThroughputPerSec: 400 })
    const opts = optimizer.optimize()
    expect(opts.some((o) => o.action === 'INCREASE_PARTITIONS')).toBe(true)
  })

  it('generateReport: 건강한 스트림 카운트 포함', () => {
    optimizer.registerStream(stream)
    optimizer.ingestMetrics(healthyMetrics)
    const report = optimizer.generateReport()
    expect(report.totalStreams).toBe(1)
    expect(report.healthyStreamCount).toBe(1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerStream(stream)
    optimizer.ingestMetrics(healthyMetrics)
    optimizer.generateReport()
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', streamId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
