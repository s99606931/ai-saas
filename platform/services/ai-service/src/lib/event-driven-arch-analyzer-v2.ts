// Design Ref: §R465 — AI기반 이벤트 드리븐 아키텍처 분석 v2
// Plan SC: SVC-AI-ADV-R465-SC01

export type EventType = 'COMMAND' | 'DOMAIN_EVENT' | 'INTEGRATION_EVENT' | 'QUERY'
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
export type ArchIssueType = 'MISSING_CONSUMER' | 'OVERLOADED_TOPIC' | 'EVENT_LOOP' | 'ORPHAN_PRODUCER' | 'HIGH_LAG'

export interface EventTopic {
  topicId: string
  name: string
  eventType: EventType
  producers: string[]    // 서비스 ID 목록
  consumers: string[]    // 서비스 ID 목록
  avgLagMessages: number
  messagesPerSecond: number
}

export interface ArchIssue {
  type: ArchIssueType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  topicId: string
  detail: string
}

export interface EDAAnalysisResult {
  totalTopics: number
  healthStatus: HealthStatus
  issues: ArchIssue[]
  orphanProducers: string[]    // 소비자 없는 토픽의 프로듀서
  overloadedTopics: string[]   // MPS 1000 이상
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  topicId: string
  detail: Record<string, unknown>
}

export class EventDrivenArchAnalyzerV2 {
  private topics = new Map<string, EventTopic>()
  private auditLog: AuditEntry[] = []

  registerTopic(topic: EventTopic): void {
    this.topics.set(topic.topicId, topic)
    this.appendAudit('topic.register', topic.topicId, { name: topic.name, producers: topic.producers.length, consumers: topic.consumers.length })
  }

  analyze(): EDAAnalysisResult {
    const allTopics = Array.from(this.topics.values())
    this.appendAudit('eda.analyze', 'system', { topicCount: allTopics.length })

    const issues: ArchIssue[] = []
    const orphanProducers: string[] = []
    const overloadedTopics: string[] = []
    const recommendations: string[] = []

    for (const topic of allTopics) {
      // 소비자 없는 토픽 (ORPHAN_PRODUCER)
      if (topic.consumers.length === 0 && topic.producers.length > 0) {
        issues.push({ type: 'ORPHAN_PRODUCER', severity: 'HIGH', topicId: topic.topicId, detail: `토픽 '${topic.name}' 소비자 없음 — 이벤트 유실 위험` })
        orphanProducers.push(...topic.producers)
        recommendations.push(`${topic.name}: 소비자 서비스 추가 또는 토픽 제거 검토`)
      }

      // 프로듀서 없는 토픽 (MISSING_CONSUMER 반대)
      if (topic.producers.length === 0 && topic.consumers.length > 0) {
        issues.push({ type: 'MISSING_CONSUMER', severity: 'MEDIUM', topicId: topic.topicId, detail: `토픽 '${topic.name}' 프로듀서 없음 — 소비자가 빈 토픽 구독 중` })
      }

      // 과부하 토픽 (MPS 1000 이상)
      if (topic.messagesPerSecond >= 1000) {
        overloadedTopics.push(topic.topicId)
        issues.push({ type: 'OVERLOADED_TOPIC', severity: 'HIGH', topicId: topic.topicId, detail: `토픽 '${topic.name}' ${topic.messagesPerSecond} MPS — 파티션 확장 검토` })
        recommendations.push(`${topic.name}: 파티션 수 증가 또는 샤딩 적용`)
      }

      // 높은 랙 (5000 메시지 이상)
      if (topic.avgLagMessages >= 5000) {
        issues.push({ type: 'HIGH_LAG', severity: 'CRITICAL', topicId: topic.topicId, detail: `토픽 '${topic.name}' 랙 ${topic.avgLagMessages}건 — 소비 처리 병목` })
        recommendations.push(`${topic.name}: 소비자 인스턴스 수평 확장 즉시 적용`)
      }
    }

    // 이벤트 루프 탐지: A→B→A 순환 의존
    const serviceTopicMap = new Map<string, Set<string>>()  // serviceId → 소비하는 서비스 집합
    for (const topic of allTopics) {
      for (const producer of topic.producers) {
        const consumerSet = serviceTopicMap.get(producer) ?? new Set<string>()
        for (const consumer of topic.consumers) {
          consumerSet.add(consumer)
        }
        serviceTopicMap.set(producer, consumerSet)
      }
    }
    for (const [svcA, consumers] of serviceTopicMap.entries()) {
      for (const svcB of consumers) {
        const bConsumers = serviceTopicMap.get(svcB)
        if (bConsumers?.has(svcA)) {
          issues.push({ type: 'EVENT_LOOP', severity: 'CRITICAL', topicId: 'system', detail: `이벤트 루프 탐지: ${svcA} ↔ ${svcB} 순환 의존` })
          recommendations.push(`${svcA}↔${svcB} 순환 이벤트 의존 제거 — 도메인 경계 재설계 필요`)
          break
        }
      }
    }

    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length
    const highCount = issues.filter((i) => i.severity === 'HIGH').length
    const healthStatus: HealthStatus =
      criticalCount > 0 ? 'CRITICAL'
        : highCount > 0 ? 'DEGRADED'
        : 'HEALTHY'

    return { totalTopics: allTopics.length, healthStatus, issues, orphanProducers, overloadedTopics, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, topicId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, topicId, detail })
  }
}
