// Design Ref: §R225 — AI기반 서비스 상태 자동 진단
// Plan SC: SVC-AI-ADV-R225-SC01

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DOWN'

export interface ServiceEndpoint {
  serviceId: string
  name: string
  dependencies: string[]
}

export interface HealthMetric {
  serviceId: string
  timestamp: string
  cpuPercent: number
  memoryPercent: number
  errorRatePercent: number
  latencyMs: number
  activeConnections: number
}

export interface DiagnosticReport {
  serviceId: string
  status: HealthStatus
  score: number  // 0~100
  issues: string[]
  rootCauseHypothesis: string
  remediationSteps: string[]
  diagnosedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceHealthDiagnosticianAI {
  private endpoints = new Map<string, ServiceEndpoint>()
  private metricsHistory = new Map<string, HealthMetric[]>()
  private auditLog: AuditEntry[] = []

  registerService(endpoint: ServiceEndpoint): void {
    this.endpoints.set(endpoint.serviceId, endpoint)
    this.metricsHistory.set(endpoint.serviceId, [])
    this.appendAudit('service.register', endpoint.serviceId, { name: endpoint.name })
  }

  ingestMetric(metric: HealthMetric): void {
    if (!this.endpoints.has(metric.serviceId)) throw new Error(`Unknown service: ${metric.serviceId}`)
    const history = this.metricsHistory.get(metric.serviceId) ?? []
    history.push(metric)
    this.metricsHistory.set(metric.serviceId, history)
  }

  diagnose(serviceId: string): DiagnosticReport {
    const endpoint = this.endpoints.get(serviceId)
    if (!endpoint) throw new Error(`Unknown service: ${serviceId}`)

    const history = this.metricsHistory.get(serviceId) ?? []
    const issues: string[] = []
    const remediationSteps: string[] = []

    if (history.length === 0) {
      return {
        serviceId,
        status: 'HEALTHY',
        score: 100,
        issues: [],
        rootCauseHypothesis: '진단 데이터 없음',
        remediationSteps: ['메트릭 수집 에이전트 배포 확인'],
        diagnosedAt: new Date().toISOString(),
      }
    }

    // history.length > 0 guaranteed by early return above
    const latestIdx = history.length - 1
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const latest = history[latestIdx]!
    let score = 100

    if (latest.cpuPercent >= 90) { issues.push(`CPU 과부하 (${latest.cpuPercent}%)`); score -= 25; remediationSteps.push('수평 스케일 아웃 또는 CPU 집약 쿼리 최적화') }
    else if (latest.cpuPercent >= 70) { issues.push(`CPU 높음 (${latest.cpuPercent}%)`); score -= 10 }

    if (latest.memoryPercent >= 90) { issues.push(`메모리 부족 (${latest.memoryPercent}%)`); score -= 25; remediationSteps.push('메모리 누수 조사 또는 JVM 힙 설정 증가') }
    else if (latest.memoryPercent >= 80) { issues.push(`메모리 높음 (${latest.memoryPercent}%)`); score -= 10 }

    if (latest.errorRatePercent >= 5) { issues.push(`에러율 높음 (${latest.errorRatePercent}%)`); score -= 30; remediationSteps.push('최근 배포 롤백 검토, 에러 로그 분석') }
    else if (latest.errorRatePercent >= 1) { issues.push(`에러율 주의 (${latest.errorRatePercent}%)`); score -= 10 }

    if (latest.latencyMs >= 2000) { issues.push(`레이턴시 심각 (${latest.latencyMs}ms)`); score -= 20; remediationSteps.push('DB 슬로우 쿼리 조사, 캐시 활성화') }
    else if (latest.latencyMs >= 500) { issues.push(`레이턴시 높음 (${latest.latencyMs}ms)`); score -= 8 }

    score = Math.max(0, score)
    const status: HealthStatus = score >= 80 ? 'HEALTHY' : score >= 50 ? 'DEGRADED' : score >= 20 ? 'CRITICAL' : 'DOWN'

    const rootCauseHypothesis = issues.length === 0 ? '이상 없음' : `주요 원인: ${issues[0]}`

    this.appendAudit('service.diagnose', serviceId, { status, score })

    return {
      serviceId,
      status,
      score,
      issues,
      rootCauseHypothesis,
      remediationSteps,
      diagnosedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
