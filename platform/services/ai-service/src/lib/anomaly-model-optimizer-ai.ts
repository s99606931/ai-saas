// Design Ref: §R312 — AI기반 이상 탐지 모델 자동 최적화
// Plan SC: SC-R312

export type DataGrade = 'O' | 'C' | 'S'

export interface AnomalyModel {
  id: string
  name: string
  currentThreshold: number
  targetF1: number
}

export interface PerformanceSample {
  threshold: number
  precision: number
  recall: number
  f1: number
  timestamp: number
}

export interface ThresholdRecommendation {
  modelId: string
  currentThreshold: number
  recommendedThreshold: number
  expectedF1: number
  improvementRatio: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function computeF1(precision: number, recall: number): number {
  if (precision <= 0 || recall <= 0) return 0
  return (2 * precision * recall) / (precision + recall)
}

export class AnomalyModelOptimizerAI {
  private models = new Map<string, AnomalyModel>()
  private performance = new Map<string, PerformanceSample[]>()
  private auditLog: AuditEntry[] = []

  registerModel(id: string, name: string, initialThreshold: number, targetF1: number): void {
    if (!id || !name) throw new Error('id와 name 필수')
    if (initialThreshold < 0 || initialThreshold > 1) throw new Error('threshold는 0~1')
    if (targetF1 < 0 || targetF1 > 1) throw new Error('targetF1은 0~1')
    this.models.set(id, { id, name, currentThreshold: initialThreshold, targetF1 })
    this.performance.set(id, [])
    this.auditLog.push({ action: 'model.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordPerformance(
    modelId: string,
    threshold: number,
    precision: number,
    recall: number,
    grade: DataGrade = 'O'
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 성능 기록 금지 (N2SF N-05)`)
    }
    if (!this.models.has(modelId)) throw new Error(`modelId 없음: ${modelId}`)
    if (threshold < 0 || threshold > 1) throw new Error('threshold는 0~1')
    if (precision < 0 || precision > 1) throw new Error('precision은 0~1')
    if (recall < 0 || recall > 1) throw new Error('recall은 0~1')
    const f1 = Math.round(computeF1(precision, recall) * 10000) / 10000
    this.performance.get(modelId)!.push({ threshold, precision, recall, f1, timestamp: Date.now() })
    this.auditLog.push({
      action: 'performance.record',
      timestamp: new Date().toISOString(),
      detail: `${modelId}:f1=${f1}`,
    })
  }

  getOptimalThreshold(modelId: string): ThresholdRecommendation {
    const model = this.models.get(modelId)
    if (!model) throw new Error(`modelId 없음: ${modelId}`)
    const samples = this.performance.get(modelId) ?? []
    if (samples.length === 0) {
      return {
        modelId,
        currentThreshold: model.currentThreshold,
        recommendedThreshold: model.currentThreshold,
        expectedF1: 0,
        improvementRatio: 0,
      }
    }
    const best = samples.reduce((a, b) => (b.f1 > a.f1 ? b : a))
    const currentSample = samples.find((s) => s.threshold === model.currentThreshold)
    const currentF1 = currentSample?.f1 ?? 0
    const improvement = currentF1 > 0 ? Math.round(((best.f1 - currentF1) / currentF1) * 10000) / 10000 : 0
    return {
      modelId,
      currentThreshold: model.currentThreshold,
      recommendedThreshold: best.threshold,
      expectedF1: best.f1,
      improvementRatio: improvement,
    }
  }

  getCurrentF1(modelId: string): number {
    const model = this.models.get(modelId)
    if (!model) throw new Error(`modelId 없음: ${modelId}`)
    const samples = this.performance.get(modelId) ?? []
    const sample = samples
      .filter((s) => s.threshold === model.currentThreshold)
      .sort((a, b) => b.timestamp - a.timestamp)[0]
    return sample?.f1 ?? 0
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
