// Design Ref: §R193 — AI기반 스트리밍 이상 감지
// Plan SC: SVC-AI-ADV-R193-SC01

export interface StreamConfig {
  streamId: string
  name: string
  expectedRatePerSecond: number
  anomalyThresholdSigma: number  // Z-score threshold (default 2.0)
}

export interface StreamEvent {
  streamId: string
  windowId: string
  eventCount: number
  timestamp: number  // epoch ms
}

export type AnomalyType = 'SPIKE' | 'DROP' | 'STOP'

export interface AnomalyAlert {
  streamId: string
  windowId: string
  anomalyType: AnomalyType
  zScore: number
  observedRate: number
  expectedRate: number
  detectedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  streamId: string
  detail: Record<string, unknown>
}

export class StreamingAnomalyDetector {
  private configs = new Map<string, StreamConfig>()
  private windows = new Map<string, StreamEvent[]>()
  private alerts: AnomalyAlert[] = []
  private auditLog: AuditEntry[] = []

  registerStream(config: StreamConfig): void {
    this.configs.set(config.streamId, config)
    this.windows.set(config.streamId, [])
    this.appendAudit('stream.register', config.streamId, { name: config.name })
  }

  ingest(event: StreamEvent): AnomalyAlert | null {
    const config = this.configs.get(event.streamId)
    if (!config) throw new Error(`Unknown stream: ${event.streamId}`)

    const history = this.windows.get(event.streamId) ?? []

    // Compute baseline stats from historical data before adding current event
    if (history.length < 2) {
      history.push(event)
      this.windows.set(event.streamId, history)
      return null
    }

    const baselineRates = history.map((e) => e.eventCount)
    const mean = baselineRates.reduce((a, b) => a + b, 0) / baselineRates.length
    const variance = baselineRates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / baselineRates.length
    const std = Math.sqrt(variance)

    history.push(event)
    this.windows.set(event.streamId, history)

    const currentRate = event.eventCount

    // When baseline std=0 (all same), any deviation is anomalous
    let zScore: number
    if (std === 0) {
      if (currentRate === mean) return null
      zScore = currentRate > mean ? config.anomalyThresholdSigma + 1 : -(config.anomalyThresholdSigma + 1)
    } else {
      zScore = (currentRate - mean) / std
    }

    const absZ = Math.abs(zScore)
    if (absZ <= config.anomalyThresholdSigma) return null

    const anomalyType: AnomalyType = currentRate === 0 ? 'STOP' : zScore > 0 ? 'SPIKE' : 'DROP'

    const alert: AnomalyAlert = {
      streamId: event.streamId,
      windowId: event.windowId,
      anomalyType,
      zScore,
      observedRate: currentRate,
      expectedRate: mean,
      detectedAt: new Date().toISOString(),
    }

    this.alerts.push(alert)
    this.appendAudit('anomaly.detected', event.streamId, { anomalyType, zScore, windowId: event.windowId })

    return alert
  }

  getAlerts(streamId?: string): AnomalyAlert[] {
    if (streamId) return this.alerts.filter((a) => a.streamId === streamId)
    return [...this.alerts]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, streamId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, streamId, detail })
  }
}
