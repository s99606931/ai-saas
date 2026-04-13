// Design Ref: §핵심 알고리즘 — SLO 달성률 계산, 보정 권고
// Plan SC: SVC-AI-ADV-R326
export type DataGrade = 'O' | 'C' | 'S'

export interface SloDefinition {
  id: string
  name: string
  targetSlo: number
  sloTargetValue: number
  metric: string
}

export interface SloStatus {
  sloId: string
  achievementRate: number
  targetSlo: number
  needsCalibration: boolean
  measurementCount: number
}

export interface CalibrationRecommendation {
  sloId: string
  sloName: string
  achievementRate: number
  targetSlo: number
  gap: number
  recommendation: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceLevelAutoCalibratorAI {
  private slos = new Map<string, SloDefinition>()
  private measurements = new Map<string, number[]>()
  private auditLog: AuditEntry[] = []

  registerSlo(id: string, name: string, targetSlo: number, sloTargetValue: number, metric: string): void {
    if (!id || !name || !metric) throw new Error('id, name, metric은 필수')
    if (targetSlo < 0 || targetSlo > 100) throw new Error('targetSlo는 0~100')
    this.slos.set(id, { id, name, targetSlo, sloTargetValue, metric })
    this.measurements.set(id, [])
    this.auditLog.push({ action: 'slo.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordMeasurement(sloId: string, value: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 SLO 데이터 기록 금지 (N2SF N-05)`)
    }
    if (!this.slos.has(sloId)) throw new Error(`sloId 없음: ${sloId}`)
    this.measurements.get(sloId)!.push(value)
    this.auditLog.push({ action: 'measurement.record', timestamp: new Date().toISOString(), detail: `${sloId}:${value}` })
  }

  getSloStatus(sloId: string): SloStatus {
    const slo = this.slos.get(sloId)
    if (!slo) throw new Error(`sloId 없음: ${sloId}`)
    const values = this.measurements.get(sloId) ?? []
    const count = values.length
    if (count === 0) {
      return { sloId, achievementRate: 100, targetSlo: slo.targetSlo, needsCalibration: false, measurementCount: 0 }
    }
    const achieved = values.filter((v) => v >= slo.sloTargetValue).length
    const achievementRate = Math.round((achieved / count) * 10000) / 100
    return {
      sloId,
      achievementRate,
      targetSlo: slo.targetSlo,
      needsCalibration: achievementRate < slo.targetSlo,
      measurementCount: count,
    }
  }

  getCalibrationRecommendations(): CalibrationRecommendation[] {
    const recommendations: CalibrationRecommendation[] = []
    for (const slo of this.slos.values()) {
      const status = this.getSloStatus(slo.id)
      if (status.needsCalibration) {
        const gap = Math.round((slo.targetSlo - status.achievementRate) * 100) / 100
        let recommendation: string
        if (gap > 10) recommendation = '즉시 용량 증설 필요'
        else if (gap > 5) recommendation = '성능 최적화 검토'
        else recommendation = '모니터링 강화'
        recommendations.push({ sloId: slo.id, sloName: slo.name, achievementRate: status.achievementRate, targetSlo: slo.targetSlo, gap, recommendation })
      }
    }
    return recommendations
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
