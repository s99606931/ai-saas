// Design Ref: §핵심 알고리즘 — Z-Score 이상 탐지
// Plan SC: SVC-AI-ADV-R406
export type DataGrade = 'O' | 'C' | 'S'

export interface AnomalyEvent {
  streamId: string
  value: number
  zScore: number
  timestamp: string
}

interface StreamData {
  id: string
  name: string
  zScoreThreshold: number
  values: number[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class RealtimeStreamAnomalyDetectorV2 {
  private streams = new Map<string, StreamData>()
  private anomalies = new Map<string, AnomalyEvent[]>()
  private auditLog: AuditEntry[] = []

  registerStream(id: string, name: string, zScoreThreshold: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (zScoreThreshold <= 0) throw new Error('zScoreThreshold는 양수여야 합니다')
    this.streams.set(id, { id, name, zScoreThreshold, values: [] })
    this.anomalies.set(id, [])
    this.auditLog.push({ action: 'stream.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordDataPoint(streamId: string, value: number, grade: DataGrade = 'O'): AnomalyEvent | null {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 스트림 데이터 전송 금지 (N2SF N-05)`)
    }
    const stream = this.streams.get(streamId)
    if (!stream) throw new Error(`streamId 없음: ${streamId}`)
    stream.values.push(value)
    this.auditLog.push({ action: 'datapoint.record', timestamp: new Date().toISOString(), detail: `${streamId}:${value}` })
    if (stream.values.length < 2) return null
    const n = stream.values.length
    const mean = stream.values.reduce((s, v) => s + v, 0) / n
    const variance = stream.values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    const stdDev = Math.sqrt(variance)
    if (stdDev === 0) return null
    const zScore = Math.abs(value - mean) / stdDev
    if (zScore <= stream.zScoreThreshold) return null
    const event: AnomalyEvent = { streamId, value, zScore: Math.round(zScore * 100) / 100, timestamp: new Date().toISOString() }
    this.anomalies.get(streamId)!.push(event)
    this.auditLog.push({ action: 'anomaly.detected', timestamp: new Date().toISOString(), detail: `${streamId}:z=${event.zScore}` })
    return event
  }

  getAnomalyEvents(streamId: string): AnomalyEvent[] {
    if (!this.streams.has(streamId)) throw new Error(`streamId 없음: ${streamId}`)
    return [...(this.anomalies.get(streamId) ?? [])]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
