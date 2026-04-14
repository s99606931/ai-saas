// Design Ref: §R556 — AI기반 공공기관 서비스 통합 모니터링 v2
// Plan SC: SVC-AI-ADV-R556-SC01

export type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN'

export interface MonitoredService {
  serviceId: string
  name: string
  tier: 'CRITICAL' | 'STANDARD' | 'LOW'
}

export interface ServiceMetrics {
  serviceId: string
  timestamp: string
  cpuUsagePct: number
  memoryUsagePct: number
  avgResponseTimeMs: number
  errorRatePct: number
  availabilityPct: number
  activeConnections: number
}

export interface ServiceHealthReport {
  serviceId: string
  name: string
  status: ServiceHealthStatus
  latestMetrics: ServiceMetrics | null
  alerts: string[]
  recommendations: string[]
}

export interface MonitoringSummary {
  totalServices: number
  healthyCount: number
  degradedCount: number
  criticalCount: number
  unknownCount: number
  reports: ServiceHealthReport[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class IntegratedMonitoringAIV2 {
  private services = new Map<string, MonitoredService>()
  private metricsHistory = new Map<string, ServiceMetrics[]>()
  private auditLog: AuditEntry[] = []

  registerService(service: MonitoredService): void {
    this.services.set(service.serviceId, service)
    this.metricsHistory.set(service.serviceId, [])
    this.appendAudit('service.register', service.serviceId, { name: service.name, tier: service.tier })
  }

  ingestMetrics(metrics: ServiceMetrics): void {
    const history = this.metricsHistory.get(metrics.serviceId)
    if (!history) return
    history.push(metrics)
    // 최근 100개만 보관
    if (history.length > 100) history.splice(0, history.length - 100)
    this.appendAudit('metrics.ingest', metrics.serviceId, { cpuUsagePct: metrics.cpuUsagePct, errorRatePct: metrics.errorRatePct })
  }

  getServiceHealth(serviceId: string): ServiceHealthReport {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    const history = this.metricsHistory.get(serviceId) ?? []
    const latest = history[history.length - 1] ?? null

    const alerts: string[] = []
    const recommendations: string[] = []
    let status: ServiceHealthStatus = 'UNKNOWN'

    if (latest) {
      status = this.calculateStatus(latest, alerts)
      this.buildRecommendations(latest, recommendations)
    }

    this.appendAudit('health.check', serviceId, { status })
    return { serviceId, name: service.name, status, latestMetrics: latest, alerts, recommendations }
  }

  generateReport(): MonitoringSummary {
    const reports = Array.from(this.services.keys()).map((id) => this.getServiceHealth(id))
    const healthyCount = reports.filter((r) => r.status === 'HEALTHY').length
    const degradedCount = reports.filter((r) => r.status === 'DEGRADED').length
    const criticalCount = reports.filter((r) => r.status === 'CRITICAL').length
    const unknownCount = reports.filter((r) => r.status === 'UNKNOWN').length
    this.appendAudit('report.generate', 'system', { totalServices: reports.length, criticalCount })
    return {
      totalServices: reports.length,
      healthyCount,
      degradedCount,
      criticalCount,
      unknownCount,
      reports,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private calculateStatus(m: ServiceMetrics, alerts: string[]): ServiceHealthStatus {
    if (m.cpuUsagePct > 90 || m.errorRatePct > 10 || m.availabilityPct < 95) {
      if (m.cpuUsagePct > 90) alerts.push(`CPU 사용률 ${m.cpuUsagePct}% — 임계값(90%) 초과`)
      if (m.errorRatePct > 10) alerts.push(`오류율 ${m.errorRatePct}% — 임계값(10%) 초과`)
      if (m.availabilityPct < 95) alerts.push(`가용성 ${m.availabilityPct}% — 임계값(95%) 미달`)
      return 'CRITICAL'
    }
    if (m.cpuUsagePct > 70 || m.errorRatePct > 5 || m.availabilityPct < 99) {
      if (m.cpuUsagePct > 70) alerts.push(`CPU 사용률 ${m.cpuUsagePct}% — 경고 수준`)
      if (m.errorRatePct > 5) alerts.push(`오류율 ${m.errorRatePct}% — 경고 수준`)
      if (m.availabilityPct < 99) alerts.push(`가용성 ${m.availabilityPct}% — SLA 미달 위험`)
      return 'DEGRADED'
    }
    return 'HEALTHY'
  }

  private buildRecommendations(m: ServiceMetrics, recommendations: string[]): void {
    if (m.cpuUsagePct > 70) recommendations.push('CPU 최적화 또는 수평 확장 검토')
    if (m.memoryUsagePct > 80) recommendations.push('메모리 누수 점검 및 힙 설정 조정')
    if (m.avgResponseTimeMs > 500) recommendations.push('응답 시간 최적화 — 캐싱 또는 쿼리 튜닝 검토')
    if (m.errorRatePct > 1) recommendations.push('오류 로그 분석 및 근본 원인 파악 필요')
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
