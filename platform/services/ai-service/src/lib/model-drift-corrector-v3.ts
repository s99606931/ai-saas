// Design Ref: SVC-AI-ADV-R627 — AI기반 모델 드리프트 교정 v2 (impl v3)
// Plan SC: FR-R627.1~5
import { createHash } from 'crypto'

interface DriftSample {
  modelId: string
  timestamp: number
  accuracy: number // 0..1
  f1: number // 0..1
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

type DriftStatus = 'STABLE' | 'WARNING' | 'DRIFT' | 'SEVERE_DRIFT'
type Action = 'MONITOR' | 'RECALIBRATE' | 'RETRAIN' | 'ROLLBACK'

interface DriftReport {
  modelId: string
  status: DriftStatus
  action: Action
  baselineAccuracy: number
  currentAccuracy: number
  accuracyDelta: number
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class ModelDriftCorrectorV3 {
  private samples = new Map<string, DriftSample[]>()
  private baselines = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  setBaseline(modelId: string, baselineAccuracy: number): void {
    this.baselines.set(modelId, baselineAccuracy)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SET_BASELINE',
      actor: maskPII(modelId),
      details: { baselineAccuracy },
    })
  }

  recordSample(sample: DriftSample, dataGrade?: 'C' | 'S' | 'O'): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const arr = this.samples.get(sample.modelId) ?? []
    arr.push({ ...sample })
    this.samples.set(sample.modelId, arr)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_SAMPLE',
      actor: maskPII(sample.modelId),
      details: { accuracy: sample.accuracy, f1: sample.f1 },
    })
  }

  analyze(modelId: string): DriftReport | null {
    const baseline = this.baselines.get(modelId)
    const samples = this.samples.get(modelId) ?? []
    if (baseline === undefined || samples.length === 0) return null
    // Use last 5 samples' mean accuracy as "current"
    const recent = samples.slice(-5)
    const currentAccuracy =
      recent.reduce((s, x) => s + x.accuracy, 0) / recent.length
    const accuracyDelta = Math.round((baseline - currentAccuracy) * 10000) / 10000

    let status: DriftStatus
    let action: Action
    if (accuracyDelta <= 0.02) {
      status = 'STABLE'
      action = 'MONITOR'
    } else if (accuracyDelta <= 0.05) {
      status = 'WARNING'
      action = 'RECALIBRATE'
    } else if (accuracyDelta <= 0.15) {
      status = 'DRIFT'
      action = 'RETRAIN'
    } else {
      status = 'SEVERE_DRIFT'
      action = 'ROLLBACK'
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_DRIFT',
      actor: maskPII(modelId),
      details: { status, accuracyDelta },
    })

    return {
      modelId: maskPII(modelId),
      status,
      action,
      baselineAccuracy: baseline,
      currentAccuracy: Math.round(currentAccuracy * 10000) / 10000,
      accuracyDelta,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
