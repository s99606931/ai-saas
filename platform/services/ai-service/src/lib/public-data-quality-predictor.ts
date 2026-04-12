// Design Ref: §R233 — AI기반 공공 데이터 품질 예측
// Plan SC: SVC-AI-ADV-R233-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type QualityDimension = 'COMPLETENESS' | 'ACCURACY' | 'CONSISTENCY' | 'TIMELINESS'
export type QualityLevel = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'

export interface DatasetProfile {
  datasetId: string
  name: string
  totalRecords: number
  grade?: DataGrade
}

export interface QualityMeasurement {
  datasetId: string
  dimension: QualityDimension
  score: number  // 0~100
  measuredAt: string
}

export interface QualityPrediction {
  datasetId: string
  overallScore: number
  level: QualityLevel
  dimensionScores: Record<QualityDimension, number>
  issues: string[]
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  datasetId: string
  detail: Record<string, unknown>
}

export class PublicDataQualityPredictor {
  private datasets = new Map<string, DatasetProfile>()
  private measurements = new Map<string, QualityMeasurement[]>()
  private auditLog: AuditEntry[] = []

  registerDataset(profile: DatasetProfile): void {
    // N2SF: C/S 등급 데이터셋 AI 분석 차단
    if (profile.grade === 'C' || profile.grade === 'S') {
      throw new Error(`BLOCKED: ${profile.grade}등급 데이터셋은 AI 품질 분석 금지 (N2SF N-05)`)
    }
    this.datasets.set(profile.datasetId, profile)
    this.measurements.set(profile.datasetId, [])
    this.appendAudit('dataset.register', profile.datasetId, { name: profile.name })
  }

  recordMeasurement(measurement: QualityMeasurement): void {
    if (!this.datasets.has(measurement.datasetId)) throw new Error(`Unknown dataset: ${measurement.datasetId}`)
    if (measurement.score < 0 || measurement.score > 100) throw new Error('score는 0~100 범위여야 합니다')
    const list = this.measurements.get(measurement.datasetId) ?? []
    list.push(measurement)
    this.measurements.set(measurement.datasetId, list)
  }

  predict(datasetId: string): QualityPrediction {
    const dataset = this.datasets.get(datasetId)
    if (!dataset) throw new Error(`Unknown dataset: ${datasetId}`)

    const allMeasurements = this.measurements.get(datasetId) ?? []
    const dimensions: QualityDimension[] = ['COMPLETENESS', 'ACCURACY', 'CONSISTENCY', 'TIMELINESS']
    const dimensionScores = {} as Record<QualityDimension, number>
    const issues: string[] = []

    for (const dim of dimensions) {
      const dimMeasurements = allMeasurements.filter((m) => m.dimension === dim)
      if (dimMeasurements.length === 0) {
        dimensionScores[dim] = 70  // 기본값
      } else {
        const avg = dimMeasurements.reduce((s, m) => s + m.score, 0) / dimMeasurements.length
        dimensionScores[dim] = Math.round(avg)
        if (avg < 60) issues.push(`${dim} 점수 낮음 (${Math.round(avg)}점)`)
      }
    }

    const overallScore = Math.round(
      Object.values(dimensionScores).reduce((s, v) => s + v, 0) / dimensions.length
    )

    const level: QualityLevel =
      overallScore >= 90 ? 'EXCELLENT' :
      overallScore >= 75 ? 'GOOD' :
      overallScore >= 60 ? 'FAIR' : 'POOR'

    const recommendation =
      level === 'POOR' ? '데이터 품질 전면 재검토 및 정제 필요' :
      issues.length > 0 ? `개선 필요 차원: ${issues.join(', ')}` :
      '현재 품질 수준 유지 권장'

    this.appendAudit('quality.predict', datasetId, { overallScore, level })

    return { datasetId, overallScore, level, dimensionScores, issues, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, datasetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, datasetId, detail })
  }
}
