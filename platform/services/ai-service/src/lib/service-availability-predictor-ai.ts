// Design Ref: §R307 — AI기반 서비스 가용성 예측
// Plan SC: SC-R307

export type DataGrade = 'O' | 'C' | 'S'

export interface AvailabilityService {
  id: string
  name: string
  targetAvailability: number
}

export interface AvailabilityRecord {
  availabilityPercent: number
  timestamp: number
}

export interface PredictionResult {
  serviceId: string
  predictedAvailability: number
  targetAvailability: number
  atRisk: boolean
  samplesUsed: number
}

export interface AvailabilityAlert {
  serviceId: string
  serviceName: string
  predicted: number
  target: number
  gap: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceAvailabilityPredictorAI {
  private services = new Map<string, AvailabilityService>()
  private records = new Map<string, AvailabilityRecord[]>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string, targetAvailability: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (targetAvailability <= 0 || targetAvailability > 100) {
      throw new Error('targetAvailability는 0~100 범위')
    }
    this.services.set(id, { id, name, targetAvailability })
    this.records.set(id, [])
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordAvailability(serviceId: string, availabilityPercent: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 가용성 기록 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    if (availabilityPercent < 0 || availabilityPercent > 100) {
      throw new Error('availabilityPercent는 0~100 범위')
    }
    this.records.get(serviceId)!.push({ availabilityPercent, timestamp: Date.now() })
    this.auditLog.push({
      action: 'availability.record',
      timestamp: new Date().toISOString(),
      detail: `${serviceId}:${availabilityPercent}`,
    })
  }

  predictAvailability(serviceId: string, windowSize = 5): PredictionResult {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`serviceId 없음: ${serviceId}`)
    const records = this.records.get(serviceId) ?? []
    const recent = records.slice(-windowSize)
    if (recent.length === 0) {
      return {
        serviceId,
        predictedAvailability: 100,
        targetAvailability: service.targetAvailability,
        atRisk: false,
        samplesUsed: 0,
      }
    }
    let weightSum = 0
    let valueSum = 0
    recent.forEach((r, i) => {
      const w = i + 1
      weightSum += w
      valueSum += r.availabilityPercent * w
    })
    const predicted = Math.round((valueSum / weightSum) * 100) / 100
    return {
      serviceId,
      predictedAvailability: predicted,
      targetAvailability: service.targetAvailability,
      atRisk: predicted < service.targetAvailability,
      samplesUsed: recent.length,
    }
  }

  getAlerts(): AvailabilityAlert[] {
    const alerts: AvailabilityAlert[] = []
    for (const service of this.services.values()) {
      const pred = this.predictAvailability(service.id)
      if (pred.atRisk && pred.samplesUsed > 0) {
        alerts.push({
          serviceId: service.id,
          serviceName: service.name,
          predicted: pred.predictedAvailability,
          target: service.targetAvailability,
          gap: Math.round((service.targetAvailability - pred.predictedAvailability) * 100) / 100,
        })
      }
    }
    return alerts
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
