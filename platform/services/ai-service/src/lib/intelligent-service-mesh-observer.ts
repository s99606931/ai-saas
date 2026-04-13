// Design Ref: §R349 — AI기반 지능형 서비스 메시 관찰
// Plan SC: SC-R349

export interface MeshService {
  serviceId: string
  serviceName: string
  namespace: string
  replicas: number
}

export interface MeshMetric {
  serviceId: string
  timestamp: number
  requestRate: number
  errorRate: number
  p99LatencyMs: number
  activeConnections: number
}

export type MeshHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN'

export interface MeshObservation {
  serviceId: string
  serviceName: string
  healthStatus: MeshHealthStatus
  errorRatePercent: number
  p99LatencyMs: number
  requestRate: number
  anomalies: string[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class IntelligentServiceMeshObserver {
  private services = new Map<string, MeshService>()
  private metrics = new Map<string, MeshMetric[]>()
  private auditLog: AuditEntry[] = []

  registerService(service: MeshService): void {
    this.services.set(service.serviceId, service)
    this.metrics.set(service.serviceId, [])
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: service.serviceId })
  }

  recordMetric(metric: MeshMetric): void {
    if (!this.services.has(metric.serviceId)) throw new Error(`Service not found: ${metric.serviceId}`)
    this.metrics.get(metric.serviceId)!.push(metric)
    this.auditLog.push({ action: 'metric.record', timestamp: new Date().toISOString(), detail: metric.serviceId })
  }

  observe(serviceId: string): MeshObservation {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`Service not found: ${serviceId}`)

    const records = this.metrics.get(serviceId) ?? []
    const latest = records[records.length - 1]

    if (!latest) {
      this.auditLog.push({ action: 'mesh.observe', timestamp: new Date().toISOString(), detail: `${serviceId}:UNKNOWN` })
      return {
        serviceId, serviceName: service.serviceName,
        healthStatus: 'UNKNOWN', errorRatePercent: 0,
        p99LatencyMs: 0, requestRate: 0, anomalies: [], recommendations: [],
      }
    }

    const errorRatePercent = latest.errorRate * 100
    const anomalies: string[] = []
    const recommendations: string[] = []

    if (latest.errorRate >= 0.05) {
      anomalies.push(`에러율 ${errorRatePercent.toFixed(1)}% — 임계치(5%) 초과`)
      recommendations.push('에러 원인 분석 및 서킷브레이커 적용 검토')
    }
    if (latest.p99LatencyMs >= 1000) {
      anomalies.push(`P99 레이턴시 ${latest.p99LatencyMs}ms — 임계치(1000ms) 초과`)
      recommendations.push('슬로우 쿼리 및 다운스트림 의존성 점검')
    }
    if (latest.activeConnections >= 1000) {
      anomalies.push(`활성 연결 ${latest.activeConnections} — 과부하 감지`)
      recommendations.push('수평 스케일아웃 또는 커넥션 풀 조정')
    }

    let healthStatus: MeshHealthStatus
    if (latest.errorRate >= 0.1 || latest.p99LatencyMs >= 3000) {
      healthStatus = 'CRITICAL'
    } else if (latest.errorRate >= 0.05 || latest.p99LatencyMs >= 1000) {
      healthStatus = 'DEGRADED'
    } else {
      healthStatus = 'HEALTHY'
    }

    this.auditLog.push({ action: 'mesh.observe', timestamp: new Date().toISOString(), detail: `${serviceId}:${healthStatus}` })
    return { serviceId, serviceName: service.serviceName, healthStatus, errorRatePercent, p99LatencyMs: latest.p99LatencyMs, requestRate: latest.requestRate, anomalies, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
