// Design Ref: §핵심 알고리즘 — 가중치 기반 라우팅, 부하 통계
// Plan SC: SVC-AI-ADV-R329
export type DataGrade = 'O' | 'C' | 'S'
export type EndpointStatus = 'active' | 'inactive'

export interface ApiEndpoint {
  id: string
  url: string
  weight: number
  status: EndpointStatus
  routeCount: number
  latencies: number[]
}

export interface RoutingDecision {
  endpointId: string
  url: string
  weight: number
  timestamp: number
}

export interface LoadStats {
  endpointId: string
  url: string
  routeCount: number
  weight: number
  avgLatencyMs: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ApiLoadAutoDistributor {
  private endpoints = new Map<string, ApiEndpoint>()
  private auditLog: AuditEntry[] = []
  private totalRouted = 0

  registerEndpoint(id: string, url: string, weight: number, status: EndpointStatus): void {
    if (!id || !url) throw new Error('id와 url은 필수')
    if (weight <= 0) throw new Error('weight는 양수여야 합니다')
    this.endpoints.set(id, { id, url, weight, status, routeCount: 0, latencies: [] })
    this.auditLog.push({ action: 'endpoint.register', timestamp: new Date().toISOString(), detail: id })
  }

  route(grade: DataGrade = 'O'): RoutingDecision {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 부하 분산 데이터 전송 금지 (N2SF N-05)`)
    }
    const active = [...this.endpoints.values()].filter((e) => e.status === 'active')
    if (active.length === 0) throw new Error('활성 엔드포인트가 없습니다')

    const totalWeight = active.reduce((s, e) => s + e.weight, 0)
    const rand = Math.random() * totalWeight
    let cumulative = 0
    let selected = active[active.length - 1]!
    for (const ep of active) {
      cumulative += ep.weight
      if (rand < cumulative) {
        selected = ep
        break
      }
    }

    selected.routeCount++
    this.totalRouted++
    const decision: RoutingDecision = { endpointId: selected.id, url: selected.url, weight: selected.weight, timestamp: Date.now() }
    this.auditLog.push({ action: 'request.route', timestamp: new Date().toISOString(), detail: selected.id })
    return decision
  }

  recordLatency(endpointId: string, latencyMs: number): void {
    const ep = this.endpoints.get(endpointId)
    if (!ep) throw new Error(`endpointId 없음: ${endpointId}`)
    ep.latencies.push(latencyMs)
  }

  getLoadStats(): LoadStats[] {
    return [...this.endpoints.values()].map((ep) => ({
      endpointId: ep.id,
      url: ep.url,
      routeCount: ep.routeCount,
      weight: ep.weight,
      avgLatencyMs: ep.latencies.length === 0 ? 0 : Math.round(ep.latencies.reduce((a, b) => a + b, 0) / ep.latencies.length),
    }))
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
