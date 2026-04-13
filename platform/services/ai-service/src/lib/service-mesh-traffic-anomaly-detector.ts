// Design Ref: §R385 — AI기반 서비스 메시 트래픽 이상 탐지
// Plan SC: SC-R385

export interface TrafficBaseline {
  serviceId: string
  routeId: string
  avgRequestsPerMin: number
  avgErrorRate: number
  avgLatencyMs: number
}

export interface TrafficSnapshot {
  serviceId: string
  routeId: string
  timestamp: number
  requestsPerMin: number
  errorRate: number
  latencyMs: number
}

export type TrafficAnomalyType = 'TRAFFIC_SPIKE' | 'ERROR_SURGE' | 'LATENCY_SPIKE' | 'TRAFFIC_DROP' | 'NONE'

export interface TrafficAnomalyReport {
  serviceId: string
  routeId: string
  anomalyType: TrafficAnomalyType
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NONE'
  deviationPercent: number
  description: string
  recommendedAction: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceMeshTrafficAnomalyDetector {
  private baselines = new Map<string, TrafficBaseline>()
  private auditLog: AuditEntry[] = []

  registerBaseline(baseline: TrafficBaseline): void {
    const key = `${baseline.serviceId}:${baseline.routeId}`
    this.baselines.set(key, baseline)
    this.auditLog.push({ action: 'baseline.register', timestamp: new Date().toISOString(), detail: key })
  }

  detect(snapshot: TrafficSnapshot): TrafficAnomalyReport {
    const key = `${snapshot.serviceId}:${snapshot.routeId}`
    const baseline = this.baselines.get(key)
    if (!baseline) throw new Error(`Baseline not found: ${key}`)

    let anomalyType: TrafficAnomalyType = 'NONE'
    let severity: TrafficAnomalyReport['severity'] = 'NONE'
    let deviationPercent = 0
    let description = '정상 트래픽'
    let recommendedAction = '모니터링 유지'

    // 에러율 급증 우선 검사
    if (baseline.avgErrorRate > 0 && snapshot.errorRate > baseline.avgErrorRate * 3) {
      deviationPercent = Math.round((snapshot.errorRate / baseline.avgErrorRate - 1) * 100)
      anomalyType = 'ERROR_SURGE'
      severity = snapshot.errorRate >= 0.1 ? 'CRITICAL' : 'HIGH'
      description = `에러율 ${(snapshot.errorRate * 100).toFixed(1)}% — 기준선 대비 ${deviationPercent}% 급증`
      recommendedAction = '서킷브레이커 적용 및 근본 원인 분석'
    } else if (baseline.avgLatencyMs > 0 && snapshot.latencyMs > baseline.avgLatencyMs * 2) {
      deviationPercent = Math.round((snapshot.latencyMs / baseline.avgLatencyMs - 1) * 100)
      anomalyType = 'LATENCY_SPIKE'
      severity = snapshot.latencyMs > baseline.avgLatencyMs * 5 ? 'CRITICAL' : 'HIGH'
      description = `레이턴시 ${snapshot.latencyMs}ms — 기준선 대비 ${deviationPercent}% 증가`
      recommendedAction = '슬로우 쿼리 점검 및 캐시 적용 검토'
    } else if (baseline.avgRequestsPerMin > 0 && snapshot.requestsPerMin > baseline.avgRequestsPerMin * 3) {
      deviationPercent = Math.round((snapshot.requestsPerMin / baseline.avgRequestsPerMin - 1) * 100)
      anomalyType = 'TRAFFIC_SPIKE'
      severity = 'HIGH'
      description = `요청량 ${snapshot.requestsPerMin}rpm — 기준선 대비 ${deviationPercent}% 급증`
      recommendedAction = '자동 스케일아웃 트리거 및 DDoS 여부 확인'
    } else if (baseline.avgRequestsPerMin > 0 && snapshot.requestsPerMin < baseline.avgRequestsPerMin * 0.2) {
      deviationPercent = Math.round((1 - snapshot.requestsPerMin / baseline.avgRequestsPerMin) * 100)
      anomalyType = 'TRAFFIC_DROP'
      severity = 'MEDIUM'
      description = `요청량 ${snapshot.requestsPerMin}rpm — 기준선 대비 ${deviationPercent}% 급감`
      recommendedAction = '서비스 헬스체크 및 업스트림 장애 확인'
    }

    this.auditLog.push({ action: 'traffic.detect', timestamp: new Date().toISOString(), detail: `${key}:${anomalyType}` })
    return { serviceId: snapshot.serviceId, routeId: snapshot.routeId, anomalyType, severity, deviationPercent, description, recommendedAction }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
