// Design Ref: §R586 — AI기반 실시간 서비스 가용성 예측 v2
// Plan SC: SVC-AI-ADV-R586-SC01

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface AvailabilityRecord {
  serviceId: string
  date: string          // 'YYYY-MM-DD'
  availabilityPct: number    // 0..100
  totalIncidents: number
  mttrMinutes: number   // Mean Time to Recover
}

export interface AvailabilityPrediction {
  serviceId: string
  predictedAvailabilityPct: number
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  alerts: AvailabilityAlert[]
  recommendation: string
}

export interface AvailabilityAlert {
  alertId: string
  serviceId: string
  severity: AlertSeverity
  message: string
  detectedAt: string
  acknowledged: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceAvailabilityPredictorV2 {
  private history = new Map<string, AvailabilityRecord[]>()
  private alerts: AvailabilityAlert[] = []
  private auditLog: AuditEntry[] = []

  ingestHistory(record: AvailabilityRecord): void {
    const list = this.history.get(record.serviceId) ?? []
    list.push(record)
    // 날짜순 정렬 유지
    list.sort((a, b) => a.date.localeCompare(b.date))
    this.history.set(record.serviceId, list)
    this.appendAudit('history.ingest', record.serviceId, { date: record.date, availabilityPct: record.availabilityPct })
  }

  predict(serviceId: string): AvailabilityPrediction {
    const records = this.history.get(serviceId) ?? []
    if (records.length === 0) throw new Error(`No history for service: ${serviceId}`)

    // 최근 7일 데이터 사용
    const recent = records.slice(-7)
    const avgAvailability = recent.reduce((s, r) => s + r.availabilityPct, 0) / recent.length

    const trend = this.calculateTrend(recent)
    const predictedAvailabilityPct = this.calcPrediction(avgAvailability, trend)

    const newAlerts: AvailabilityAlert[] = []
    if (predictedAvailabilityPct < 95) {
      newAlerts.push(this.createAlert(serviceId, 'CRITICAL', `예측 가용성 ${predictedAvailabilityPct.toFixed(1)}% — SLA 위반 위험`))
    } else if (predictedAvailabilityPct < 99) {
      newAlerts.push(this.createAlert(serviceId, 'WARNING', `예측 가용성 ${predictedAvailabilityPct.toFixed(1)}% — SLA 기준(99%) 미달 예상`))
    }
    if (trend === 'DECLINING') {
      newAlerts.push(this.createAlert(serviceId, 'WARNING', '가용성 하락 추세 감지 — 근본 원인 분석 필요'))
    }
    this.alerts.push(...newAlerts)

    const riskLevel =
      predictedAvailabilityPct < 95 ? 'CRITICAL'
        : predictedAvailabilityPct < 99 ? 'HIGH'
        : trend === 'DECLINING' ? 'MEDIUM'
        : 'LOW'

    const recommendation =
      riskLevel === 'CRITICAL' ? '즉시 장애 대응팀 소집 및 복구 계획 실행'
        : riskLevel === 'HIGH' ? '24시간 내 근본 원인 분석 및 개선 조치'
        : trend === 'DECLINING' ? '가용성 하락 요인 점검 — 인프라 상태 확인 권고'
        : '현재 상태 유지 — 정기 모니터링 지속'

    this.appendAudit('availability.predict', serviceId, { predictedAvailabilityPct, trend, riskLevel })
    return { serviceId, predictedAvailabilityPct: Math.round(predictedAvailabilityPct * 10) / 10, trend, riskLevel, alerts: newAlerts, recommendation }
  }

  getAlerts(serviceId?: string): AvailabilityAlert[] {
    const filtered = serviceId ? this.alerts.filter((a) => a.serviceId === serviceId) : this.alerts
    return filtered.filter((a) => !a.acknowledged)
  }

  acknowledge(alertId: string): void {
    const alert = this.alerts.find((a) => a.alertId === alertId)
    if (!alert) throw new Error(`Unknown alert: ${alertId}`)
    alert.acknowledged = true
    this.appendAudit('alert.acknowledge', alert.serviceId, { alertId })
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private calculateTrend(records: AvailabilityRecord[]): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    if (records.length < 2) return 'STABLE'
    const firstRecord = records[0]
    const lastRecord = records[records.length - 1]
    if (!firstRecord || !lastRecord) return 'STABLE'
    const first = firstRecord.availabilityPct
    const last = lastRecord.availabilityPct
    if (last > first + 0.5) return 'IMPROVING'
    if (last < first - 0.5) return 'DECLINING'
    return 'STABLE'
  }

  private calcPrediction(avg: number, trend: 'IMPROVING' | 'STABLE' | 'DECLINING'): number {
    if (trend === 'IMPROVING') return Math.min(100, avg + 0.3)
    if (trend === 'DECLINING') return Math.max(0, avg - 0.5)
    return avg
  }

  private createAlert(serviceId: string, severity: AlertSeverity, message: string): AvailabilityAlert {
    return {
      alertId: `ALT-${serviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      serviceId,
      severity,
      message,
      detectedAt: new Date().toISOString(),
      acknowledged: false,
    }
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
