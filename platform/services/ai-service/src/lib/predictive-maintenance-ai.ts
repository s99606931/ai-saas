// Design Ref: §R252 — 설비 예측 유지보수 AI
// Plan SC: SVC-AI-ADV-R252-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type SensorMetric = 'VIBRATION' | 'TEMPERATURE' | 'PRESSURE' | 'CURRENT'
export type MaintenanceUrgency = 'IMMEDIATE' | 'WEEK' | 'MONTH' | 'SCHEDULED'
export type AnomalySeverity = 'HIGH' | 'MEDIUM' | 'LOW'

export interface EquipmentProfile {
  equipmentId: string
  type: string
  installedAt: string
  thresholds: Record<SensorMetric, { warn: number; critical: number }>
  grade?: DataGrade
}

export interface SensorReading {
  equipmentId: string
  metric: SensorMetric
  value: number
  timestamp: number
}

export interface AnomalyEvent {
  equipmentId: string
  metric: SensorMetric
  value: number
  severity: AnomalySeverity
  threshold: number
  detectedAt: string
}

export interface FailurePrediction {
  equipmentId: string
  probability: number  // 0~1
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  anomalyCount: number
  factors: string[]
}

export interface MaintenanceRecommendation {
  equipmentId: string
  urgency: MaintenanceUrgency
  estimatedDowntimeHours: number
  reason: string
  recommendedActions: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  equipmentId: string
  detail: Record<string, unknown>
}

export class PredictiveMaintenanceAI {
  private equipment = new Map<string, EquipmentProfile>()
  private readings = new Map<string, SensorReading[]>()
  private auditLog: AuditEntry[] = []

  registerEquipment(profile: EquipmentProfile): void {
    if (profile.grade === 'C' || profile.grade === 'S') {
      throw new Error(`BLOCKED: ${profile.grade}등급 설비 데이터는 AI 분석 금지 (N2SF N-05)`)
    }
    this.equipment.set(profile.equipmentId, profile)
    this.readings.set(profile.equipmentId, [])
    this.appendAudit('equipment.register', profile.equipmentId, { type: profile.type })
  }

  recordSensor(reading: SensorReading): void {
    if (!this.equipment.has(reading.equipmentId)) {
      throw new Error(`Unknown equipment: ${reading.equipmentId}`)
    }
    const list = this.readings.get(reading.equipmentId) ?? []
    list.push(reading)
    this.readings.set(reading.equipmentId, list)
  }

  detectAnomalies(equipmentId: string): AnomalyEvent[] {
    const profile = this.equipment.get(equipmentId)
    if (!profile) throw new Error(`Unknown equipment: ${equipmentId}`)

    const list = this.readings.get(equipmentId) ?? []
    const anomalies: AnomalyEvent[] = []
    const windowMs = 24 * 60 * 60 * 1000
    const now = Date.now()
    const recent = list.filter((r) => now - r.timestamp <= windowMs)

    for (const reading of recent) {
      const threshold = profile.thresholds[reading.metric]
      if (!threshold) continue
      if (reading.value >= threshold.critical) {
        anomalies.push({
          equipmentId,
          metric: reading.metric,
          value: reading.value,
          severity: 'HIGH',
          threshold: threshold.critical,
          detectedAt: new Date(reading.timestamp).toISOString(),
        })
      } else if (reading.value >= threshold.warn) {
        anomalies.push({
          equipmentId,
          metric: reading.metric,
          value: reading.value,
          severity: 'MEDIUM',
          threshold: threshold.warn,
          detectedAt: new Date(reading.timestamp).toISOString(),
        })
      }
    }

    this.appendAudit('anomaly.detect', equipmentId, { count: anomalies.length })
    return anomalies
  }

  predictFailureProbability(equipmentId: string): FailurePrediction {
    const anomalies = this.detectAnomalies(equipmentId)
    const weights = { HIGH: 0.3, MEDIUM: 0.12, LOW: 0.05 }
    let score = 0
    const factors: string[] = []
    for (const anom of anomalies) {
      score += weights[anom.severity]
      factors.push(`${anom.metric} ${anom.severity}`)
    }
    const probability = Math.min(1, Math.round(score * 100) / 100)
    let riskLevel: FailurePrediction['riskLevel'] = 'LOW'
    if (probability >= 0.8) riskLevel = 'CRITICAL'
    else if (probability >= 0.5) riskLevel = 'HIGH'
    else if (probability >= 0.2) riskLevel = 'MEDIUM'

    const prediction: FailurePrediction = {
      equipmentId,
      probability,
      riskLevel,
      anomalyCount: anomalies.length,
      factors: factors.slice(0, 5),
    }
    this.appendAudit('failure.predict', equipmentId, { probability, riskLevel })
    return prediction
  }

  recommendMaintenance(equipmentId: string): MaintenanceRecommendation {
    const prediction = this.predictFailureProbability(equipmentId)
    let urgency: MaintenanceUrgency = 'SCHEDULED'
    let downtime = 0
    const actions: string[] = []

    if (prediction.probability >= 0.8) {
      urgency = 'IMMEDIATE'
      downtime = 8
      actions.push('즉시 가동 중단', '전문 기술자 긴급 파견', '부품 교체 준비')
    } else if (prediction.probability >= 0.5) {
      urgency = 'WEEK'
      downtime = 4
      actions.push('1주 이내 정비 일정 수립', '예비 부품 확보')
    } else if (prediction.probability >= 0.2) {
      urgency = 'MONTH'
      downtime = 2
      actions.push('1개월 이내 점검', '센서 임계값 재조정 검토')
    } else {
      urgency = 'SCHEDULED'
      downtime = 1
      actions.push('정기 점검 주기 유지')
    }

    const recommendation: MaintenanceRecommendation = {
      equipmentId,
      urgency,
      estimatedDowntimeHours: downtime,
      reason: `고장 확률 ${(prediction.probability * 100).toFixed(0)}% (${prediction.riskLevel})`,
      recommendedActions: actions,
    }
    this.appendAudit('maintenance.recommend', equipmentId, { urgency, probability: prediction.probability })
    return recommendation
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, equipmentId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      equipmentId,
      detail,
    })
  }
}
