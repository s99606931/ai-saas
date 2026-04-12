// Design Ref: §R199 — AI기반 공공서비스 품질 예측
// Plan SC: SVC-AI-ADV-R199-SC01

export type ServiceType = 'ONLINE' | 'OFFLINE' | 'HYBRID'
export type QualityGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'

export interface ServiceProfile {
  serviceId: string
  name: string
  type: ServiceType
  department: string
}

export interface ServiceMetric {
  serviceId: string
  month: number  // 1~12
  satisfactionScore: number  // 0~100
  processingDays: number
  complaintCount: number
  usageCount: number
}

export interface QualityPrediction {
  serviceId: string
  predictedGrade: QualityGrade
  predictedSatisfaction: number
  riskFactors: string[]
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class PublicServiceQualityPredictor {
  private services = new Map<string, ServiceProfile>()
  private metrics = new Map<string, ServiceMetric[]>()
  private auditLog: AuditEntry[] = []

  registerService(profile: ServiceProfile): void {
    this.services.set(profile.serviceId, profile)
    this.metrics.set(profile.serviceId, [])
    this.appendAudit('service.register', profile.serviceId, { name: profile.name })
  }

  recordMetric(metric: ServiceMetric): void {
    if (!this.services.has(metric.serviceId)) throw new Error(`Unknown service: ${metric.serviceId}`)
    if (metric.month < 1 || metric.month > 12) throw new Error('월은 1~12 범위여야 합니다')
    const list = this.metrics.get(metric.serviceId) ?? []
    list.push(metric)
    this.metrics.set(metric.serviceId, list)
    this.appendAudit('metric.record', metric.serviceId, { month: metric.month, satisfaction: metric.satisfactionScore })
  }

  predict(serviceId: string): QualityPrediction {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    const history = this.metrics.get(serviceId) ?? []
    if (history.length === 0) {
      return {
        serviceId,
        predictedGrade: 'FAIR',
        predictedSatisfaction: 70,
        riskFactors: ['데이터 부족'],
        recommendation: '서비스 품질 데이터 수집 필요',
      }
    }

    const avgSatisfaction = history.reduce((s, m) => s + m.satisfactionScore, 0) / history.length
    const avgProcessingDays = history.reduce((s, m) => s + m.processingDays, 0) / history.length
    const totalComplaints = history.reduce((s, m) => s + m.complaintCount, 0)
    const riskFactors: string[] = []

    if (avgSatisfaction < 60) riskFactors.push('만족도 낮음')
    if (avgProcessingDays > 14) riskFactors.push('처리기간 초과')
    if (totalComplaints > 50) riskFactors.push('민원 다발')

    const predictedGrade: QualityGrade =
      avgSatisfaction >= 90 ? 'EXCELLENT' :
      avgSatisfaction >= 75 ? 'GOOD' :
      avgSatisfaction >= 60 ? 'FAIR' : 'POOR'

    const recommendation =
      predictedGrade === 'POOR' ? '서비스 프로세스 전면 재검토 필요' :
      riskFactors.length > 0 ? `위험 요인 개선 필요: ${riskFactors.join(', ')}` :
      '현재 수준 유지 권장'

    this.appendAudit('prediction.complete', serviceId, { predictedGrade, avgSatisfaction })

    return { serviceId, predictedGrade, predictedSatisfaction: Math.round(avgSatisfaction), riskFactors, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
