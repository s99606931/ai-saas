// Design Ref: §R361 — AI기반 공공 서비스 이용 예측
// Plan SC: SC-R361

export interface ServiceUsageHistory {
  serviceId: string
  month: string
  activeUsers: number
  apiCalls: number
  peakConcurrentUsers: number
}

export interface UsagePrediction {
  serviceId: string
  predictedMonth: string
  predictedActiveUsers: number
  predictedApiCalls: number
  predictedPeakConcurrent: number
  trend: 'GROWING' | 'STABLE' | 'DECLINING'
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  capacityWarning: boolean
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicServiceUsagePredictor {
  private histories = new Map<string, ServiceUsageHistory[]>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string): void {
    this.histories.set(serviceId, [])
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: serviceId })
  }

  recordHistory(history: ServiceUsageHistory): void {
    if (!this.histories.has(history.serviceId)) throw new Error(`Service not found: ${history.serviceId}`)
    this.histories.get(history.serviceId)!.push(history)
    this.auditLog.push({ action: 'history.record', timestamp: new Date().toISOString(), detail: history.serviceId })
  }

  predict(serviceId: string, targetMonth: string): UsagePrediction {
    if (!this.histories.has(serviceId)) throw new Error(`Service not found: ${serviceId}`)

    const records = this.histories.get(serviceId) ?? []

    if (records.length === 0) {
      this.auditLog.push({ action: 'usage.predict', timestamp: new Date().toISOString(), detail: `${serviceId}:LOW` })
      return {
        serviceId, predictedMonth: targetMonth,
        predictedActiveUsers: 0, predictedApiCalls: 0, predictedPeakConcurrent: 0,
        trend: 'STABLE', confidenceLevel: 'LOW',
        capacityWarning: false, recommendations: ['히스토리 데이터 부족 — 최소 3개월 데이터 수집 필요'],
      }
    }

    // 단순 이동평균 예측
    const recentN = Math.min(records.length, 3)
    const recent = records.slice(-recentN)
    const avgUsers = Math.round(recent.reduce((s, r) => s + r.activeUsers, 0) / recentN)
    const avgApiCalls = Math.round(recent.reduce((s, r) => s + r.apiCalls, 0) / recentN)
    const avgPeak = Math.round(recent.reduce((s, r) => s + r.peakConcurrentUsers, 0) / recentN)

    // 트렌드: 최근 vs 이전 비교
    let trend: UsagePrediction['trend'] = 'STABLE'
    if (records.length >= 2) {
      const half = Math.floor(records.length / 2)
      const recentSum = records.slice(half).reduce((s, r) => s + r.activeUsers, 0)
      const oldSum = records.slice(0, half).reduce((s, r) => s + r.activeUsers, 0)
      if (recentSum > oldSum * 1.1) trend = 'GROWING'
      else if (recentSum < oldSum * 0.9) trend = 'DECLINING'
    }

    const confidenceLevel: UsagePrediction['confidenceLevel'] = records.length >= 6 ? 'HIGH' : records.length >= 3 ? 'MEDIUM' : 'LOW'
    const capacityWarning = trend === 'GROWING' && avgPeak > 500

    const recommendations: string[] = []
    if (capacityWarning) recommendations.push('성장 추세 + 피크 사용자 초과 — 용량 증설 계획 수립')
    if (trend === 'DECLINING') recommendations.push('이용 감소 추세 — 서비스 개선 또는 홍보 강화 필요')

    this.auditLog.push({ action: 'usage.predict', timestamp: new Date().toISOString(), detail: `${serviceId}:${trend}` })
    return {
      serviceId, predictedMonth: targetMonth,
      predictedActiveUsers: avgUsers, predictedApiCalls: avgApiCalls, predictedPeakConcurrent: avgPeak,
      trend, confidenceLevel, capacityWarning, recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
