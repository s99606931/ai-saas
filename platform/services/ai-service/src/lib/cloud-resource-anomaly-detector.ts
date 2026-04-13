// Design Ref: §핵심 알고리즘 — 임계값 기반 이상 탐지, 심각도 분류
// Plan SC: SVC-AI-ADV-R324
export type DataGrade = 'O' | 'C' | 'S'
export type AnomalyMetric = 'cpu' | 'memory' | 'network'
export type AnomalySeverity = 'warning' | 'critical'

export interface ResourceThresholds {
  cpuPercent: number
  memoryPercent: number
  networkMbps: number
}

export interface CloudResource {
  id: string
  name: string
  thresholds: ResourceThresholds
}

export interface AnomalyEvent {
  resourceId: string
  metric: AnomalyMetric
  value: number
  threshold: number
  severity: AnomalySeverity
  timestamp: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function classifySeverity(value: number, threshold: number): AnomalySeverity {
  return value > threshold * 1.5 ? 'critical' : 'warning'
}

export class CloudResourceAnomalyDetector {
  private resources = new Map<string, CloudResource>()
  private anomalies = new Map<string, AnomalyEvent[]>()
  private auditLog: AuditEntry[] = []

  registerResource(id: string, name: string, thresholds: ResourceThresholds): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.resources.set(id, { id, name, thresholds })
    this.anomalies.set(id, [])
    this.auditLog.push({ action: 'resource.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordUsage(
    resourceId: string,
    cpuPercent: number,
    memoryPercent: number,
    networkMbps: number,
    grade: DataGrade = 'O'
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 리소스 데이터 기록 금지 (N2SF N-05)`)
    }
    const resource = this.resources.get(resourceId)
    if (!resource) throw new Error(`resourceId 없음: ${resourceId}`)
    const now = Date.now()
    const checks: Array<{ metric: AnomalyMetric; value: number; threshold: number }> = [
      { metric: 'cpu', value: cpuPercent, threshold: resource.thresholds.cpuPercent },
      { metric: 'memory', value: memoryPercent, threshold: resource.thresholds.memoryPercent },
      { metric: 'network', value: networkMbps, threshold: resource.thresholds.networkMbps },
    ]
    const list = this.anomalies.get(resourceId)!
    for (const check of checks) {
      if (check.value > check.threshold) {
        const event: AnomalyEvent = {
          resourceId,
          metric: check.metric,
          value: check.value,
          threshold: check.threshold,
          severity: classifySeverity(check.value, check.threshold),
          timestamp: now,
        }
        list.push(event)
        this.auditLog.push({ action: 'anomaly.detected', timestamp: new Date().toISOString(), detail: `${resourceId}:${check.metric}=${check.value}` })
      }
    }
    this.auditLog.push({ action: 'usage.record', timestamp: new Date().toISOString(), detail: `${resourceId}:cpu=${cpuPercent}` })
  }

  getAnomalies(resourceId: string): AnomalyEvent[] {
    if (!this.resources.has(resourceId)) throw new Error(`resourceId 없음: ${resourceId}`)
    return [...(this.anomalies.get(resourceId) ?? [])]
  }

  getActiveAnomalies(): AnomalyEvent[] {
    const result: AnomalyEvent[] = []
    for (const events of this.anomalies.values()) {
      result.push(...events)
    }
    return result.sort((a, b) => b.timestamp - a.timestamp)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
