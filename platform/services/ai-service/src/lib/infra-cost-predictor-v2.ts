// Design Ref: §R462 — AI기반 자동 인프라 비용 예측 v2
// Plan SC: SVC-AI-ADV-R462-SC01

export type ResourceType = 'COMPUTE' | 'STORAGE' | 'NETWORK' | 'DATABASE' | 'CACHE' | 'CDN'
export type TrendDirection = 'INCREASING' | 'STABLE' | 'DECREASING'

export interface InfraCostRecord {
  recordId: string
  serviceId: string
  resourceType: ResourceType
  periodMonth: string   // YYYY-MM
  costKrw: number
  usageUnits: number
}

export interface CostPrediction {
  serviceId: string
  resourceType: ResourceType
  predictedNextMonthKrw: number
  trend: TrendDirection
  trendPercent: number    // 전월 대비 변화율 (%)
  confidence: number      // 0..1
  anomalyDetected: boolean
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class InfraCostPredictorV2 {
  private records = new Map<string, InfraCostRecord[]>()  // `${serviceId}:${resourceType}` → records
  private auditLog: AuditEntry[] = []

  ingestRecord(record: InfraCostRecord): void {
    const key = `${record.serviceId}:${record.resourceType}`
    const list = this.records.get(key) ?? []
    list.push(record)
    // 월별 정렬 유지
    list.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
    this.records.set(key, list)
  }

  predict(serviceId: string, resourceType: ResourceType): CostPrediction {
    const key = `${serviceId}:${resourceType}`
    const history = this.records.get(key) ?? []
    this.appendAudit('cost.predict', serviceId, { resourceType, historyCount: history.length })

    if (history.length === 0) {
      return {
        serviceId, resourceType, predictedNextMonthKrw: 0,
        trend: 'STABLE', trendPercent: 0, confidence: 0,
        anomalyDetected: false, recommendation: '비용 데이터 없음 — 모니터링 설정 필요',
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const latest = history[history.length - 1]!
    // history.length > 0 guaranteed by check above

    let trend: TrendDirection = 'STABLE'
    let trendPercent = 0
    let predictedNextMonthKrw = latest.costKrw
    let confidence = 0.5

    if (history.length >= 2) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const prev = history[history.length - 2]!
      // history.length >= 2 guaranteed
      trendPercent = prev.costKrw > 0
        ? Math.round(((latest.costKrw - prev.costKrw) / prev.costKrw) * 100)
        : 0

      trend = trendPercent > 5 ? 'INCREASING' : trendPercent < -5 ? 'DECREASING' : 'STABLE'
      predictedNextMonthKrw = Math.round(latest.costKrw * (1 + trendPercent / 100))
      confidence = Math.min(0.95, 0.5 + history.length * 0.05)
    }

    // 이상 비용 탐지: 전월 대비 50% 이상 급증
    const anomalyDetected = Math.abs(trendPercent) > 50

    const recommendation =
      anomalyDetected ? `비용 ${trendPercent > 0 ? '급증' : '급감'} ${Math.abs(trendPercent)}% — 즉시 원인 조사 필요`
        : trend === 'INCREASING' ? `비용 증가 추세 ${trendPercent}% — 리소스 최적화 검토`
        : trend === 'DECREASING' ? `비용 감소 추세 — 운영 효율 양호`
        : '비용 안정적 — 정상 운영 중'

    return { serviceId, resourceType, predictedNextMonthKrw, trend, trendPercent, confidence, anomalyDetected, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
