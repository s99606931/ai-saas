// Design Ref: §R366 — AI기반 실시간 이상 탐지 고도화 v3
// Plan SC: SC-R366

export interface MetricStream {
  streamId: string
  serviceId: string
  metricName: string
  baselineAvg: number
  baselineStdDev: number
  dataGrade: 'C' | 'S' | 'O'
}

export interface MetricDataPoint {
  streamId: string
  timestamp: number
  value: number
}

export type AnomalyLevel = 'NONE' | 'WARNING' | 'ANOMALY' | 'CRITICAL'

export interface AnomalyDetectionResult {
  streamId: string
  serviceId: string
  metricName: string
  value: number
  baselineAvg: number
  zScore: number
  anomalyLevel: AnomalyLevel
  deviationPercent: number
  alert: boolean
  description: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class RealtimeAnomalyDetectorV3 {
  private streams = new Map<string, MetricStream>()
  private auditLog: AuditEntry[] = []

  registerStream(stream: MetricStream): void {
    // N2SF: C/S 등급 스트림 차단
    if (stream.dataGrade === 'C' || stream.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${stream.dataGrade}등급 메트릭 스트림 차단 (N2SF N-05)`)
    }
    this.streams.set(stream.streamId, stream)
    this.auditLog.push({ action: 'stream.register', timestamp: new Date().toISOString(), detail: stream.streamId })
  }

  detect(dataPoint: MetricDataPoint): AnomalyDetectionResult {
    const stream = this.streams.get(dataPoint.streamId)
    if (!stream) throw new Error(`Stream not found: ${dataPoint.streamId}`)

    const zScore = stream.baselineStdDev > 0
      ? Math.abs(dataPoint.value - stream.baselineAvg) / stream.baselineStdDev
      : 0

    const deviationPercent = stream.baselineAvg > 0
      ? Math.round(Math.abs(dataPoint.value - stream.baselineAvg) / stream.baselineAvg * 100)
      : 0

    let anomalyLevel: AnomalyLevel
    if (zScore >= 4) {
      anomalyLevel = 'CRITICAL'
    } else if (zScore >= 3) {
      anomalyLevel = 'ANOMALY'
    } else if (zScore >= 2) {
      anomalyLevel = 'WARNING'
    } else {
      anomalyLevel = 'NONE'
    }

    const alert = anomalyLevel === 'ANOMALY' || anomalyLevel === 'CRITICAL'

    const description = anomalyLevel === 'NONE'
      ? `정상 범위 (z=${zScore.toFixed(2)})`
      : `${stream.metricName} 이상 감지 — 기준선 대비 ${deviationPercent}% 편차 (z=${zScore.toFixed(2)})`

    this.auditLog.push({ action: 'anomaly.detect', timestamp: new Date().toISOString(), detail: `${dataPoint.streamId}:${anomalyLevel}` })
    return {
      streamId: dataPoint.streamId,
      serviceId: stream.serviceId,
      metricName: stream.metricName,
      value: dataPoint.value,
      baselineAvg: stream.baselineAvg,
      zScore: Math.round(zScore * 100) / 100,
      anomalyLevel,
      deviationPercent,
      alert,
      description,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
