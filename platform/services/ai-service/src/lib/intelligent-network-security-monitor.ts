// Design Ref: §핵심 알고리즘 — 트래픽 임계치 이상 탐지, 위협 관리
// Plan SC: SVC-AI-ADV-R380
export type DataGrade = 'O' | 'C' | 'S'

export interface NetworkSegment {
  id: string
  name: string
  thresholdMbps: number
}

export interface ThreatEvent {
  id: string
  segmentId: string
  trafficMbps: number
  sourceIp: string
  level: 'critical' | 'warning'
  resolved: boolean
  timestamp: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

let threatCounter = 0

export class IntelligentNetworkSecurityMonitor {
  private segments = new Map<string, NetworkSegment>()
  private threats = new Map<string, ThreatEvent>()
  private auditLog: AuditEntry[] = []

  registerSegment(id: string, name: string, thresholdMbps: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (thresholdMbps <= 0) throw new Error('thresholdMbps는 양수여야 합니다')
    this.segments.set(id, { id, name, thresholdMbps })
    this.auditLog.push({ action: 'segment.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordTraffic(segmentId: string, trafficMbps: number, sourceIp: string, grade: DataGrade = 'O'): ThreatEvent | null {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 네트워크 데이터 전송 금지 (N2SF N-05)`)
    }
    const segment = this.segments.get(segmentId)
    if (!segment) throw new Error(`segmentId 없음: ${segmentId}`)
    this.auditLog.push({ action: 'traffic.record', timestamp: new Date().toISOString(), detail: `${segmentId}:${trafficMbps}Mbps` })
    if (trafficMbps <= segment.thresholdMbps) return null
    const level: 'critical' | 'warning' = trafficMbps > segment.thresholdMbps * 2 ? 'critical' : 'warning'
    const threat: ThreatEvent = {
      id: `threat-${++threatCounter}`,
      segmentId,
      trafficMbps,
      sourceIp,
      level,
      resolved: false,
      timestamp: new Date().toISOString(),
    }
    this.threats.set(threat.id, threat)
    this.auditLog.push({ action: 'threat.detected', timestamp: new Date().toISOString(), detail: `${segmentId}:${level}` })
    return threat
  }

  getActiveThreats(): ThreatEvent[] {
    return [...this.threats.values()].filter((t) => !t.resolved)
  }

  resolveThreat(threatId: string): void {
    const threat = this.threats.get(threatId)
    if (!threat) throw new Error(`threatId 없음: ${threatId}`)
    threat.resolved = true
    this.auditLog.push({ action: 'threat.resolve', timestamp: new Date().toISOString(), detail: threatId })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
