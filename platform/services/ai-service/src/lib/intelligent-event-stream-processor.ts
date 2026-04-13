// Design Ref: §R412 — AI기반 지능형 이벤트 스트림 처리 최적화
// Plan SC: SC-R412

export interface StreamPartition {
  partitionId: string
  topicId: string
  processedPerMin: number
  consumerLag: number
  lagThreshold: number
}

export type PartitionStatus = 'HEALTHY' | 'CONGESTED' | 'IDLE'

export interface PartitionAnalysis {
  partitionId: string
  status: PartitionStatus
  consumerLag: number
  lagRatio: number
  recommendation: string
}

export interface StreamOptimizationReport {
  topicId: string
  totalPartitions: number
  congestedPartitions: number
  overallStatus: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL'
  partitions: PartitionAnalysis[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class IntelligentEventStreamProcessor {
  private partitions = new Map<string, StreamPartition[]>()
  private auditLog: AuditEntry[] = []

  registerPartition(partition: StreamPartition): void {
    if (!this.partitions.has(partition.topicId)) this.partitions.set(partition.topicId, [])
    this.partitions.get(partition.topicId)!.push(partition)
    this.auditLog.push({ action: 'partition.register', timestamp: new Date().toISOString(), detail: `${partition.topicId}:${partition.partitionId}` })
  }

  analyze(topicId: string): StreamOptimizationReport {
    const partitions = this.partitions.get(topicId) ?? []
    const analyses: PartitionAnalysis[] = []
    const recommendations: string[] = []

    for (const p of partitions) {
      const lagRatio = p.lagThreshold > 0 ? p.consumerLag / p.lagThreshold : 0
      let status: PartitionStatus
      let recommendation: string

      if (p.processedPerMin === 0) {
        status = 'IDLE'
        recommendation = `파티션 ${p.partitionId} 유휴 상태 — 소비자 프로세스 확인`
      } else if (p.consumerLag > p.lagThreshold) {
        status = 'CONGESTED'
        recommendation = `파티션 ${p.partitionId} 적체(lag=${p.consumerLag}) — 소비자 스케일아웃 권고`
      } else {
        status = 'HEALTHY'
        recommendation = '정상 처리 중'
      }

      analyses.push({ partitionId: p.partitionId, status, consumerLag: p.consumerLag, lagRatio: Math.round(lagRatio * 100) / 100, recommendation })
    }

    const congestedCount = analyses.filter((a) => a.status === 'CONGESTED').length
    const idleCount = analyses.filter((a) => a.status === 'IDLE').length

    const overallStatus = partitions.length === 0
      ? 'OPTIMAL'
      : congestedCount > partitions.length / 2
        ? 'CRITICAL'
        : congestedCount > 0 || idleCount > 0
          ? 'DEGRADED'
          : 'OPTIMAL'

    if (congestedCount > 0) recommendations.push(`적체 파티션 ${congestedCount}개 — 파티션 수 증가 또는 소비자 그룹 병렬화`)
    if (idleCount > 0) recommendations.push(`유휴 파티션 ${idleCount}개 — 파티션 재배분 검토`)

    this.auditLog.push({ action: 'stream.analyze', timestamp: new Date().toISOString(), detail: `${topicId}:${overallStatus}` })
    return { topicId, totalPartitions: partitions.length, congestedPartitions: congestedCount, overallStatus, partitions: analyses, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
