// Design Ref: §R240 — AI기반 멀티클라우드 네트워크 최적화
// Plan SC: SVC-AI-ADV-R240-SC01

export type CloudProvider = 'AWS' | 'AZURE' | 'GCP' | 'ON_PREMISE'
export type NetworkAction = 'REROUTE' | 'INCREASE_BANDWIDTH' | 'ENABLE_CDN' | 'NO_CHANGE'

export interface CloudEndpoint {
  endpointId: string
  provider: CloudProvider
  region: string
  currentBandwidthMbps: number
  maxBandwidthMbps: number
}

export interface NetworkMetric {
  endpointId: string
  timestamp: number
  latencyMs: number
  bandwidthUsedMbps: number
  packetLossRate: number  // 0~1
}

export interface NetworkOptimization {
  endpointId: string
  action: NetworkAction
  currentLatencyMs: number
  bandwidthUtilization: number  // 0~1
  packetLossRate: number
  recommendedBandwidthMbps: number
  reason: string
  costImpact: 'INCREASE' | 'DECREASE' | 'NEUTRAL'
}

interface AuditEntry {
  timestamp: string
  action: string
  endpointId: string
  detail: Record<string, unknown>
}

const HIGH_LATENCY_MS = 200
const HIGH_BANDWIDTH_UTIL = 0.85
const HIGH_PACKET_LOSS = 0.02

export class MulticloudNetworkOptimizer {
  private endpoints = new Map<string, CloudEndpoint>()
  private metrics = new Map<string, NetworkMetric[]>()
  private auditLog: AuditEntry[] = []

  registerEndpoint(endpoint: CloudEndpoint): void {
    this.endpoints.set(endpoint.endpointId, endpoint)
    this.metrics.set(endpoint.endpointId, [])
    this.appendAudit('endpoint.register', endpoint.endpointId, { provider: endpoint.provider, region: endpoint.region })
  }

  recordMetric(metric: NetworkMetric): void {
    if (!this.endpoints.has(metric.endpointId)) throw new Error(`Unknown endpoint: ${metric.endpointId}`)
    const list = this.metrics.get(metric.endpointId) ?? []
    list.push(metric)
    this.metrics.set(metric.endpointId, list)
  }

  optimize(endpointId: string): NetworkOptimization {
    const endpoint = this.endpoints.get(endpointId)
    if (!endpoint) throw new Error(`Unknown endpoint: ${endpointId}`)

    const history = this.metrics.get(endpointId) ?? []
    if (history.length === 0) {
      return {
        endpointId,
        action: 'NO_CHANGE',
        currentLatencyMs: 0,
        bandwidthUtilization: 0,
        packetLossRate: 0,
        recommendedBandwidthMbps: endpoint.currentBandwidthMbps,
        reason: '메트릭 데이터 없음',
        costImpact: 'NEUTRAL',
      }
    }

    const recent = history.slice(-5)
    const avgLatency = recent.reduce((s, m) => s + m.latencyMs, 0) / recent.length
    const avgBandwidthUsed = recent.reduce((s, m) => s + m.bandwidthUsedMbps, 0) / recent.length
    const avgPacketLoss = recent.reduce((s, m) => s + m.packetLossRate, 0) / recent.length
    const bandwidthUtilization = avgBandwidthUsed / endpoint.currentBandwidthMbps

    let action: NetworkAction = 'NO_CHANGE'
    let recommendedBandwidthMbps = endpoint.currentBandwidthMbps
    let reason = '네트워크 상태 정상'
    let costImpact: 'INCREASE' | 'DECREASE' | 'NEUTRAL' = 'NEUTRAL'

    if (avgPacketLoss > HIGH_PACKET_LOSS) {
      action = 'REROUTE'
      reason = `패킷 손실율 ${(avgPacketLoss * 100).toFixed(1)}% — 경로 변경 권고`
      costImpact = 'NEUTRAL'
    } else if (bandwidthUtilization > HIGH_BANDWIDTH_UTIL) {
      action = 'INCREASE_BANDWIDTH'
      recommendedBandwidthMbps = Math.min(endpoint.maxBandwidthMbps, endpoint.currentBandwidthMbps * 2)
      reason = `대역폭 사용률 ${Math.round(bandwidthUtilization * 100)}% — 대역폭 증설 권고`
      costImpact = 'INCREASE'
    } else if (avgLatency > HIGH_LATENCY_MS && endpoint.provider !== 'ON_PREMISE') {
      action = 'ENABLE_CDN'
      reason = `평균 지연 ${Math.round(avgLatency)}ms — CDN 활성화 권고`
      costImpact = 'INCREASE'
    }

    this.appendAudit('network.optimize', endpointId, { action, bandwidthUtilization: Math.round(bandwidthUtilization * 100) / 100, avgLatency: Math.round(avgLatency) })

    return {
      endpointId,
      action,
      currentLatencyMs: Math.round(avgLatency),
      bandwidthUtilization: Math.round(bandwidthUtilization * 100) / 100,
      packetLossRate: Math.round(avgPacketLoss * 10000) / 10000,
      recommendedBandwidthMbps,
      reason,
      costImpact,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, endpointId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, endpointId, detail })
  }
}
