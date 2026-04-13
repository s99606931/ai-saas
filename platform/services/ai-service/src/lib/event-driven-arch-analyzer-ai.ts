// Design Ref: §R315 — AI기반 이벤트 드리븐 아키텍처 분석
// Plan SC: SC-R315

export interface EventTopic {
  topicId: string
  name: string
  producerServiceIds: string[]
  consumerServiceIds: string[]
  avgMessageSizeKb: number
  messagesPerSecond: number
  retentionDays: number
}

export interface EventFlowMetric {
  topicId: string
  timestamp: number
  publishRate: number
  consumeRate: number
  lagMessages: number
  errorRate: number
}

export interface TopicAnalysis {
  topicId: string
  name: string
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  lagStatus: 'NORMAL' | 'WARNING' | 'CRITICAL'
  throughputStatus: 'OPTIMAL' | 'UNDERUTILIZED' | 'OVERLOADED'
  recommendations: string[]
}

export interface ArchitectureReport {
  totalTopics: number
  healthyCount: number
  degradedCount: number
  criticalCount: number
  topicAnalyses: TopicAnalysis[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class EventDrivenArchAnalyzerAi {
  private topics = new Map<string, EventTopic>()
  private metrics = new Map<string, EventFlowMetric[]>()
  private auditLog: AuditEntry[] = []

  registerTopic(topic: EventTopic): void {
    this.topics.set(topic.topicId, topic)
    this.metrics.set(topic.topicId, [])
    this.auditLog.push({ action: 'topic.register', timestamp: new Date().toISOString(), detail: topic.topicId })
  }

  recordMetric(metric: EventFlowMetric): void {
    if (!this.topics.has(metric.topicId)) throw new Error(`Topic not found: ${metric.topicId}`)
    this.metrics.get(metric.topicId)!.push(metric)
    this.auditLog.push({ action: 'metric.record', timestamp: new Date().toISOString(), detail: metric.topicId })
  }

  analyze(): ArchitectureReport {
    const topicAnalyses: TopicAnalysis[] = []

    for (const topic of this.topics.values()) {
      const records = this.metrics.get(topic.topicId) ?? []
      const latest = records[records.length - 1]
      const recommendations: string[] = []

      let healthStatus: TopicAnalysis['healthStatus'] = 'HEALTHY'
      let lagStatus: TopicAnalysis['lagStatus'] = 'NORMAL'
      let throughputStatus: TopicAnalysis['throughputStatus'] = 'OPTIMAL'

      if (latest) {
        // Lag 분석
        if (latest.lagMessages > 10000) {
          lagStatus = 'CRITICAL'
          healthStatus = 'CRITICAL'
          recommendations.push(`컨슈머 지연 심각 (lag=${latest.lagMessages}) — 컨슈머 스케일아웃 필요`)
        } else if (latest.lagMessages > 1000) {
          lagStatus = 'WARNING'
          if (healthStatus === 'HEALTHY') healthStatus = 'DEGRADED'
          recommendations.push(`컨슈머 지연 경고 (lag=${latest.lagMessages})`)
        }

        // 에러율 분석
        if (latest.errorRate > 0.05) {
          healthStatus = 'CRITICAL'
          recommendations.push(`높은 에러율 (${(latest.errorRate * 100).toFixed(1)}%) — 프로듀서/컨슈머 점검 필요`)
        } else if (latest.errorRate > 0.01) {
          if (healthStatus === 'HEALTHY') healthStatus = 'DEGRADED'
        }

        // 처리량 분석
        const utilRatio = latest.publishRate / Math.max(topic.messagesPerSecond, 1)
        if (utilRatio > 0.9) {
          throughputStatus = 'OVERLOADED'
          recommendations.push('토픽 파티션 증설 검토')
        } else if (utilRatio < 0.1) {
          throughputStatus = 'UNDERUTILIZED'
          recommendations.push('토픽 통합 또는 파티션 축소 검토')
        }
      }

      // 컨슈머 없으면 경고
      if (topic.consumerServiceIds.length === 0) {
        recommendations.push('컨슈머 미등록 — Dead Letter 토픽 검토')
        if (healthStatus === 'HEALTHY') healthStatus = 'DEGRADED'
      }

      topicAnalyses.push({ topicId: topic.topicId, name: topic.name, healthStatus, lagStatus, throughputStatus, recommendations })
    }

    const healthyCount = topicAnalyses.filter((t) => t.healthStatus === 'HEALTHY').length
    const degradedCount = topicAnalyses.filter((t) => t.healthStatus === 'DEGRADED').length
    const criticalCount = topicAnalyses.filter((t) => t.healthStatus === 'CRITICAL').length

    this.auditLog.push({ action: 'arch.analyze', timestamp: new Date().toISOString(), detail: `topics=${topicAnalyses.length}` })
    return { totalTopics: topicAnalyses.length, healthyCount, degradedCount, criticalCount, topicAnalyses }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
