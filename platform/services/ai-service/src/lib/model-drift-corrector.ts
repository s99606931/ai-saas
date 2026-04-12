// Design Ref: §R191 — AI기반 모델 드리프트 자동 수정
// Plan SC: SVC-AI-ADV-R191-SC01

export interface ModelConfig {
  modelId: string
  name: string
  baselineAccuracy: number
  baselinePrecision: number
  baselineRecall: number
  threshold: number  // drift threshold (e.g. 0.05 = 5%)
}

export interface ModelMetrics {
  modelId: string
  measuredAt: string
  accuracy: number
  precision: number
  recall: number
}

export type DriftAction = 'RETRAIN' | 'ROLLBACK' | 'ALERT' | 'NONE'

export interface DriftReport {
  modelId: string
  driftDetected: boolean
  accuracyDrop: number
  precisionDrop: number
  recallDrop: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  recommendedAction: DriftAction
  correctionApplied: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  modelId: string
  detail: Record<string, unknown>
}

export class ModelDriftCorrector {
  private configs = new Map<string, ModelConfig>()
  private metricsHistory = new Map<string, ModelMetrics[]>()
  private auditLog: AuditEntry[] = []

  registerModel(config: ModelConfig): void {
    this.configs.set(config.modelId, config)
    this.metricsHistory.set(config.modelId, [])
    this.appendAudit('model.register', config.modelId, { name: config.name })
  }

  recordMetrics(metrics: ModelMetrics): void {
    if (!this.configs.has(metrics.modelId)) throw new Error(`Unknown model: ${metrics.modelId}`)
    const history = this.metricsHistory.get(metrics.modelId) ?? []
    history.push(metrics)
    this.metricsHistory.set(metrics.modelId, history)
    this.appendAudit('metrics.record', metrics.modelId, { accuracy: metrics.accuracy })
  }

  analyzeAndCorrect(modelId: string): DriftReport {
    const config = this.configs.get(modelId)
    if (!config) throw new Error(`Unknown model: ${modelId}`)

    const history = this.metricsHistory.get(modelId) ?? []
    if (history.length === 0) {
      return {
        modelId,
        driftDetected: false,
        accuracyDrop: 0,
        precisionDrop: 0,
        recallDrop: 0,
        severity: 'NONE',
        recommendedAction: 'NONE',
        correctionApplied: false,
      }
    }

    const latest = history[history.length - 1]!
    const accuracyDrop = config.baselineAccuracy - latest.accuracy
    const precisionDrop = config.baselinePrecision - latest.precision
    const recallDrop = config.baselineRecall - latest.recall
    const maxDrop = Math.max(accuracyDrop, precisionDrop, recallDrop)
    const driftDetected = maxDrop > config.threshold

    let severity: DriftReport['severity'] = 'NONE'
    let recommendedAction: DriftAction = 'NONE'
    let correctionApplied = false

    if (driftDetected) {
      if (maxDrop >= 0.2) {
        severity = 'CRITICAL'
        recommendedAction = 'ROLLBACK'
        correctionApplied = true
      } else if (maxDrop >= 0.1) {
        severity = 'HIGH'
        recommendedAction = 'RETRAIN'
        correctionApplied = true
      } else if (maxDrop >= 0.05) {
        severity = 'MEDIUM'
        recommendedAction = 'ALERT'
        correctionApplied = false
      } else {
        severity = 'LOW'
        recommendedAction = 'ALERT'
        correctionApplied = false
      }
    }

    this.appendAudit('drift.analyze', modelId, { driftDetected, severity, recommendedAction })

    return { modelId, driftDetected, accuracyDrop, precisionDrop, recallDrop, severity, recommendedAction, correctionApplied }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, modelId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, modelId, detail })
  }
}
