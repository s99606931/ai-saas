/**
 * AI Model Health Monitor — SVC-AI-ADV-R142
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R142.design.md
 * Plan SC: FR-R142.1 ~ FR-R142.6
 *
 * 배포된 AI 모델 드리프트/정확도 실시간 모니터링.
 * 모델 입출력 원문은 수신하지 않고 메트릭 집계만 처리.
 * N2SF O등급 메트릭 강제.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL'

export interface InferenceMetric {
  modelId: string
  ts: number
  latencyMs: number
  correct: boolean
  confidence: number
}

export interface Baseline {
  accuracy: number
  avgConfidence: number
}

export interface ModelHealth {
  modelId: string
  accuracy: number
  avgLatencyMs: number
  avgConfidence: number
  driftScore: number
  status: HealthStatus
  sampleSize: number
  evaluatedAt: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface MonitorOptions {
  now?: () => number
  degradedThreshold?: number
  criticalThreshold?: number
  maxBufferPerModel?: number
}

export class AiModelHealthMonitor {
  private readonly buffers = new Map<string, InferenceMetric[]>()
  private readonly baselines = new Map<string, Baseline>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private readonly degradedThreshold: number
  private readonly criticalThreshold: number
  private readonly maxBufferPerModel: number

  constructor(opts: MonitorOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.degradedThreshold = opts.degradedThreshold ?? 0.05
    this.criticalThreshold = opts.criticalThreshold ?? 0.15
    this.maxBufferPerModel = opts.maxBufferPerModel ?? 10000
  }

  /**
   * 추론 메트릭 기록.
   * FR-R142.1
   */
  record(metric: InferenceMetric, grade: DataGrade = 'O'): void {
    this.assertDataGrade(grade)
    if (metric.confidence < 0 || metric.confidence > 1) {
      throw new Error('INVALID_METRIC: confidence must be 0~1')
    }
    if (metric.latencyMs < 0) {
      throw new Error('INVALID_METRIC: latencyMs must be >= 0')
    }
    const buf = this.buffers.get(metric.modelId) ?? []
    buf.push(metric)
    if (buf.length > this.maxBufferPerModel) {
      buf.shift()
    }
    this.buffers.set(metric.modelId, buf)
  }

  /**
   * Baseline 설정.
   */
  setBaseline(modelId: string, baseline: Baseline): void {
    if (baseline.accuracy < 0 || baseline.accuracy > 1) {
      throw new Error('INVALID_BASELINE: accuracy must be 0~1')
    }
    this.baselines.set(modelId, baseline)
  }

  /**
   * 헬스 평가.
   * FR-R142.2, FR-R142.3, FR-R142.4
   */
  evaluate(modelId: string, windowMs?: number): ModelHealth {
    const buf = this.buffers.get(modelId) ?? []
    const now = this.now()
    const cutoff = windowMs ? now - windowMs : 0
    const windowBuf = buf.filter((m) => m.ts >= cutoff)

    if (windowBuf.length === 0) {
      return {
        modelId,
        accuracy: 0,
        avgLatencyMs: 0,
        avgConfidence: 0,
        driftScore: 0,
        status: 'CRITICAL',
        sampleSize: 0,
        evaluatedAt: now,
      }
    }

    const correctCount = windowBuf.filter((m) => m.correct).length
    const accuracy = correctCount / windowBuf.length
    const avgLatencyMs =
      windowBuf.reduce((acc, m) => acc + m.latencyMs, 0) / windowBuf.length
    const avgConfidence =
      windowBuf.reduce((acc, m) => acc + m.confidence, 0) / windowBuf.length

    const baseline = this.baselines.get(modelId)
    const driftScore = baseline
      ? this.computeDriftScore({ accuracy, avgConfidence }, baseline)
      : 0

    const status = this.determineStatus(driftScore, baseline !== undefined, accuracy)

    const health: ModelHealth = {
      modelId,
      accuracy,
      avgLatencyMs,
      avgConfidence,
      driftScore,
      status,
      sampleSize: windowBuf.length,
      evaluatedAt: now,
    }

    this.auditLog.push({
      event: 'model.health.evaluated',
      detail: { modelId, status, sampleSize: windowBuf.length, driftScore },
      at: now,
    })

    return health
  }

  /**
   * 드리프트 스코어.
   * FR-R142.3
   */
  computeDriftScore(
    current: { accuracy: number; avgConfidence: number },
    baseline: Baseline,
  ): number {
    const accDelta = Math.abs(baseline.accuracy - current.accuracy)
    const confDelta = Math.abs(baseline.avgConfidence - current.avgConfidence)
    return accDelta * 0.7 + confDelta * 0.3
  }

  /**
   * 감사 로그.
   * FR-R142.5
   */
  getAuditLog(): ReadonlyArray<AuditEntry> {
    return [...this.auditLog]
  }

  private determineStatus(
    driftScore: number,
    hasBaseline: boolean,
    accuracy: number,
  ): HealthStatus {
    if (!hasBaseline) {
      if (accuracy < 0.5) {
        return 'CRITICAL'
      }
      if (accuracy < 0.8) {
        return 'DEGRADED'
      }
      return 'HEALTHY'
    }
    if (driftScore >= this.criticalThreshold) {
      return 'CRITICAL'
    }
    if (driftScore >= this.degradedThreshold) {
      return 'DEGRADED'
    }
    return 'HEALTHY'
  }

  private assertDataGrade(grade: DataGrade): void {
    if (grade !== 'O') {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 AI Model Health Monitor 전송 금지 (N2SF N-05)`,
      )
    }
  }
}
