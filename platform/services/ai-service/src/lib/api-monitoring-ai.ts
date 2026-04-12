// Design Ref: §R232 — AI기반 자동 API 모니터링
// Plan SC: SVC-AI-ADV-R232-SC01

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ApiEndpointConfig {
  endpointId: string
  path: string
  method: HttpMethod
  slaResponseMs: number   // SLA 응답 시간 (ms)
  errorRateThreshold: number  // 0~1
}

export interface ApiCallRecord {
  endpointId: string
  timestamp: number
  responseMs: number
  statusCode: number
  success: boolean
}

export interface ApiAlert {
  endpointId: string
  alertType: 'SLA_BREACH' | 'ERROR_RATE' | 'NO_TRAFFIC'
  severity: AlertSeverity
  value: number
  threshold: number
  detectedAt: string
}

export interface ApiHealthReport {
  endpointId: string
  totalCalls: number
  avgResponseMs: number
  p99ResponseMs: number
  errorRate: number
  alerts: ApiAlert[]
}

interface AuditEntry {
  timestamp: string
  action: string
  endpointId: string
  detail: Record<string, unknown>
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, idx)] ?? 0
}

export class ApiMonitoringAi {
  private configs = new Map<string, ApiEndpointConfig>()
  private records = new Map<string, ApiCallRecord[]>()
  private alerts: ApiAlert[] = []
  private auditLog: AuditEntry[] = []

  registerEndpoint(config: ApiEndpointConfig): void {
    this.configs.set(config.endpointId, config)
    this.records.set(config.endpointId, [])
    this.appendAudit('endpoint.register', config.endpointId, { path: config.path, method: config.method })
  }

  recordCall(record: ApiCallRecord): void {
    if (!this.configs.has(record.endpointId)) throw new Error(`Unknown endpoint: ${record.endpointId}`)
    const list = this.records.get(record.endpointId) ?? []
    list.push(record)
    this.records.set(record.endpointId, list)
  }

  analyze(endpointId: string): ApiHealthReport {
    const config = this.configs.get(endpointId)
    if (!config) throw new Error(`Unknown endpoint: ${endpointId}`)

    const calls = this.records.get(endpointId) ?? []
    if (calls.length === 0) {
      const alert: ApiAlert = {
        endpointId,
        alertType: 'NO_TRAFFIC',
        severity: 'MEDIUM',
        value: 0,
        threshold: 1,
        detectedAt: new Date().toISOString(),
      }
      this.alerts.push(alert)
      this.appendAudit('endpoint.analyze', endpointId, { alert: 'NO_TRAFFIC' })
      return { endpointId, totalCalls: 0, avgResponseMs: 0, p99ResponseMs: 0, errorRate: 0, alerts: [alert] }
    }

    const responseTimes = calls.map((c) => c.responseMs).sort((a, b) => a - b)
    const avgResponseMs = responseTimes.reduce((s, r) => s + r, 0) / responseTimes.length
    const p99ResponseMs = percentile(responseTimes, 0.99)
    const errorRate = calls.filter((c) => !c.success).length / calls.length

    const endpointAlerts: ApiAlert[] = []

    if (avgResponseMs > config.slaResponseMs) {
      const alert: ApiAlert = {
        endpointId,
        alertType: 'SLA_BREACH',
        severity: avgResponseMs > config.slaResponseMs * 2 ? 'CRITICAL' : 'HIGH',
        value: Math.round(avgResponseMs),
        threshold: config.slaResponseMs,
        detectedAt: new Date().toISOString(),
      }
      endpointAlerts.push(alert)
      this.alerts.push(alert)
    }

    if (errorRate > config.errorRateThreshold) {
      const alert: ApiAlert = {
        endpointId,
        alertType: 'ERROR_RATE',
        severity: errorRate > 0.5 ? 'CRITICAL' : errorRate > 0.2 ? 'HIGH' : 'MEDIUM',
        value: Math.round(errorRate * 100) / 100,
        threshold: config.errorRateThreshold,
        detectedAt: new Date().toISOString(),
      }
      endpointAlerts.push(alert)
      this.alerts.push(alert)
    }

    this.appendAudit('endpoint.analyze', endpointId, { avgResponseMs: Math.round(avgResponseMs), errorRate, alertCount: endpointAlerts.length })

    return {
      endpointId,
      totalCalls: calls.length,
      avgResponseMs: Math.round(avgResponseMs),
      p99ResponseMs: Math.round(p99ResponseMs),
      errorRate: Math.round(errorRate * 100) / 100,
      alerts: endpointAlerts,
    }
  }

  getAlerts(endpointId?: string): ApiAlert[] {
    if (endpointId) return this.alerts.filter((a) => a.endpointId === endpointId)
    return [...this.alerts]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, endpointId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, endpointId, detail })
  }
}
