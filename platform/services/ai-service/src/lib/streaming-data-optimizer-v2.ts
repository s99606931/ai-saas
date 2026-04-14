// Design Ref: §R588 — AI기반 자동 스트리밍 데이터 처리 최적화 v2
// Plan SC: SVC-AI-ADV-R588-SC01

export type StreamIssueType = 'BOTTLENECK' | 'HIGH_LAG' | 'PARTITION_IMBALANCE' | 'CONSUMER_LAG'
export type OptimizationAction = 'INCREASE_PARTITIONS' | 'ADD_CONSUMERS' | 'REDUCE_BATCH_SIZE' | 'ENABLE_COMPRESSION'

export interface StreamDefinition {
  streamId: string
  name: string
  topicName: string
  partitionCount: number
  consumerCount: number
  expectedThroughputPerSec: number
}

export interface StreamMetrics {
  streamId: string
  currentThroughputPerSec: number
  avgLagMs: number
  errorRatePct: number
  partitionUtilization: number[]  // 파티션별 사용률 (0..100)
}

export interface StreamIssue {
  issueId: string
  streamId: string
  issueType: StreamIssueType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  detail: string
}

export interface StreamOptimization {
  streamId: string
  action: OptimizationAction
  currentValue: number
  recommendedValue: number
  expectedImprovementPct: number
  reason: string
}

export interface StreamingOptimizationReport {
  totalStreams: number
  issuesFound: StreamIssue[]
  optimizations: StreamOptimization[]
  healthyStreamCount: number
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  streamId: string
  detail: Record<string, unknown>
}

export class StreamingDataOptimizerV2 {
  private streams = new Map<string, StreamDefinition>()
  private latestMetrics = new Map<string, StreamMetrics>()
  private auditLog: AuditEntry[] = []

  registerStream(stream: StreamDefinition): void {
    this.streams.set(stream.streamId, stream)
    this.appendAudit('stream.register', stream.streamId, { name: stream.name, partitions: stream.partitionCount })
  }

  ingestMetrics(metrics: StreamMetrics): void {
    this.latestMetrics.set(metrics.streamId, metrics)
    this.appendAudit('metrics.ingest', metrics.streamId, { throughput: metrics.currentThroughputPerSec, lag: metrics.avgLagMs })
  }

  analyze(): StreamIssue[] {
    const issues: StreamIssue[] = []
    for (const stream of this.streams.values()) {
      const m = this.latestMetrics.get(stream.streamId)
      if (!m) continue

      if (m.currentThroughputPerSec < stream.expectedThroughputPerSec * 0.7) {
        issues.push({ issueId: `ISS-${stream.streamId}-BTL`, streamId: stream.streamId, issueType: 'BOTTLENECK', severity: 'CRITICAL', detail: `처리량 ${m.currentThroughputPerSec}/s — 기대치(${stream.expectedThroughputPerSec}/s)의 70% 미달` })
      }
      if (m.avgLagMs > 500) {
        issues.push({ issueId: `ISS-${stream.streamId}-LAG`, streamId: stream.streamId, issueType: 'HIGH_LAG', severity: 'HIGH', detail: `평균 지연 ${m.avgLagMs}ms — 임계값(500ms) 초과` })
      }
      if (m.partitionUtilization.length > 0) {
        const maxUtil = Math.max(...m.partitionUtilization)
        const minUtil = Math.min(...m.partitionUtilization)
        if (maxUtil - minUtil > 40) {
          issues.push({ issueId: `ISS-${stream.streamId}-IMBAL`, streamId: stream.streamId, issueType: 'PARTITION_IMBALANCE', severity: 'MEDIUM', detail: `파티션 불균형 — 최대 ${maxUtil}% vs 최소 ${minUtil}%` })
        }
      }
    }
    this.appendAudit('stream.analyze', 'system', { issueCount: issues.length })
    return issues
  }

  optimize(): StreamOptimization[] {
    const optimizations: StreamOptimization[] = []
    for (const stream of this.streams.values()) {
      const m = this.latestMetrics.get(stream.streamId)
      if (!m) continue

      if (m.currentThroughputPerSec < stream.expectedThroughputPerSec * 0.7) {
        optimizations.push({ streamId: stream.streamId, action: 'INCREASE_PARTITIONS', currentValue: stream.partitionCount, recommendedValue: stream.partitionCount * 2, expectedImprovementPct: 40, reason: '처리량 증대를 위한 파티션 확장' })
      }
      if (m.avgLagMs > 500) {
        optimizations.push({ streamId: stream.streamId, action: 'ADD_CONSUMERS', currentValue: stream.consumerCount, recommendedValue: stream.consumerCount + 2, expectedImprovementPct: 30, reason: '처리 지연 감소를 위한 컨슈머 추가' })
      }
      if (m.errorRatePct > 1) {
        optimizations.push({ streamId: stream.streamId, action: 'REDUCE_BATCH_SIZE', currentValue: 1000, recommendedValue: 500, expectedImprovementPct: 20, reason: '오류율 감소를 위한 배치 크기 축소' })
      }
    }
    return optimizations
  }

  generateReport(): StreamingOptimizationReport {
    const issues = this.analyze()
    const optimizations = this.optimize()
    const affectedIds = new Set(issues.map((i) => i.streamId))
    const healthyStreamCount = this.streams.size - affectedIds.size
    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length
    const recommendations: string[] = []
    if (criticalCount > 0) recommendations.push(`CRITICAL 스트림 ${criticalCount}개 — 즉시 파티션 재조정 필요`)
    this.appendAudit('report.generate', 'system', { totalStreams: this.streams.size, issueCount: issues.length })
    return { totalStreams: this.streams.size, issuesFound: issues, optimizations, healthyStreamCount, recommendations, generatedAt: new Date().toISOString() }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, streamId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, streamId, detail })
  }
}
