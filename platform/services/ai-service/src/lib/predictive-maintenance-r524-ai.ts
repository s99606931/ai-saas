// Design Ref: §R524 — AI기반 공공기관 예측적 유지보수
// Plan SC: SVC-AI-ADV-R524-SC01

export type ComponentType = 'SERVER' | 'NETWORK' | 'STORAGE' | 'DATABASE' | 'APPLICATION'
export type MaintenanceUrgency = 'SCHEDULED' | 'SOON' | 'URGENT' | 'IMMEDIATE'
export type FailureProbability = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ComponentHealth {
  componentId: string
  componentType: ComponentType
  name: string
  ageMonths: number
  lastMaintenanceDaysAgo: number
  errorCountLast30Days: number
  cpuTemperatureCelsius?: number
  diskHealthPct?: number
  memoryErrorCount?: number
}

export interface MaintenancePrediction {
  componentId: string
  componentType: ComponentType
  name: string
  failureProbability: FailureProbability
  estimatedFailureDays: number
  urgency: MaintenanceUrgency
  predictedIssues: string[]
  recommendedActions: string[]
}

export interface MaintenancePlan {
  totalComponents: number
  immediateActions: MaintenancePrediction[]
  scheduledMaintenance: MaintenancePrediction[]
  healthySystems: string[]
  overallHealthScore: number
}

interface AuditEntry {
  timestamp: string
  action: string
  componentId: string
  detail: Record<string, unknown>
}

export class PredictiveMaintenanceR524AI {
  private components = new Map<string, ComponentHealth>()
  private auditLog: AuditEntry[] = []

  registerComponent(component: ComponentHealth): void {
    this.components.set(component.componentId, component)
    this.appendAudit('component.register', component.componentId, { type: component.componentType, name: component.name })
  }

  predict(componentId: string): MaintenancePrediction {
    const comp = this.components.get(componentId)
    if (!comp) throw new Error(`Unknown component: ${componentId}`)

    this.appendAudit('maintenance.predict', componentId, { type: comp.componentType })

    const predictedIssues: string[] = []
    const recommendedActions: string[] = []
    let riskScore = 0

    if (comp.ageMonths > 60) {
      riskScore += 30
      predictedIssues.push(`노후 장비 (${comp.ageMonths}개월 사용) — 하드웨어 장애 위험`)
      recommendedActions.push('장비 교체 계획 수립')
    } else if (comp.ageMonths > 36) {
      riskScore += 15
    }

    if (comp.lastMaintenanceDaysAgo > 180) {
      riskScore += 20
      predictedIssues.push(`유지보수 ${comp.lastMaintenanceDaysAgo}일 미실시`)
      recommendedActions.push('정기 유지보수 즉시 일정 수립')
    } else if (comp.lastMaintenanceDaysAgo > 90) {
      riskScore += 10
    }

    if (comp.errorCountLast30Days >= 10) {
      riskScore += 30
      predictedIssues.push(`30일 내 오류 ${comp.errorCountLast30Days}건 — 장애 전조`)
      recommendedActions.push('오류 원인 즉시 분석 및 조치')
    } else if (comp.errorCountLast30Days >= 3) {
      riskScore += 10
    }

    if (comp.cpuTemperatureCelsius !== undefined && comp.cpuTemperatureCelsius >= 85) {
      riskScore += 25
      predictedIssues.push(`CPU 온도 ${comp.cpuTemperatureCelsius}°C — 과열`)
      recommendedActions.push('냉각 시스템 점검 및 서버실 온도 확인')
    }

    if (comp.diskHealthPct !== undefined && comp.diskHealthPct < 20) {
      riskScore += 35
      predictedIssues.push(`디스크 건강도 ${comp.diskHealthPct}% — 즉시 교체 필요`)
      recommendedActions.push('디스크 즉시 교체 및 백업 검증')
    }

    const failureProbability: FailureProbability =
      riskScore >= 70 ? 'CRITICAL'
        : riskScore >= 50 ? 'HIGH'
        : riskScore >= 25 ? 'MEDIUM'
        : 'LOW'

    const estimatedFailureDays =
      failureProbability === 'CRITICAL' ? 7
        : failureProbability === 'HIGH' ? 30
        : failureProbability === 'MEDIUM' ? 90
        : 365

    const urgency: MaintenanceUrgency =
      failureProbability === 'CRITICAL' ? 'IMMEDIATE'
        : failureProbability === 'HIGH' ? 'URGENT'
        : failureProbability === 'MEDIUM' ? 'SOON'
        : 'SCHEDULED'

    return { componentId, componentType: comp.componentType, name: comp.name, failureProbability, estimatedFailureDays, urgency, predictedIssues, recommendedActions }
  }

  generatePlan(): MaintenancePlan {
    const allComponents = Array.from(this.components.values())
    this.appendAudit('plan.generate', 'system', { componentCount: allComponents.length })

    const predictions = allComponents.map((c) => this.predict(c.componentId))
    const immediateActions = predictions.filter((p) => p.urgency === 'IMMEDIATE' || p.urgency === 'URGENT')
    const scheduledMaintenance = predictions.filter((p) => p.urgency === 'SOON' || p.urgency === 'SCHEDULED')
    const healthySystems = predictions.filter((p) => p.failureProbability === 'LOW').map((p) => p.componentId)

    const criticalCount = predictions.filter((p) => p.failureProbability === 'CRITICAL').length
    const highCount = predictions.filter((p) => p.failureProbability === 'HIGH').length
    const overallHealthScore = allComponents.length > 0
      ? Math.max(0, Math.round(100 - criticalCount * 20 - highCount * 10))
      : 100

    return { totalComponents: allComponents.length, immediateActions, scheduledMaintenance, healthySystems, overallHealthScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, componentId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, componentId, detail })
  }
}
