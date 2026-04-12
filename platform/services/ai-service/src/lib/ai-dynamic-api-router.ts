// Design Ref: §R202 — AI기반 API 게이트웨이 동적 라우팅
// Plan SC: SVC-AI-ADV-R202-SC01

export type LoadBalanceStrategy = 'ROUND_ROBIN' | 'LEAST_CONN' | 'WEIGHTED' | 'LATENCY'
export type RouteHealth = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'

export interface ServiceEndpoint {
  endpointId: string
  serviceId: string
  url: string
  weight: number  // 1~100 for WEIGHTED strategy
  version: string
}

export interface RouteRule {
  ruleId: string
  pathPattern: string
  serviceId: string
  strategy: LoadBalanceStrategy
  timeoutMs: number
  retryCount: number
}

export interface HealthStatus {
  endpointId: string
  health: RouteHealth
  latencyMs: number
  errorRate: number  // 0~1
  lastChecked: string
}

export interface RoutingDecision {
  ruleId: string
  selectedEndpoint: string
  reason: string
  fallbackUsed: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  ruleId: string
  detail: Record<string, unknown>
}

export class AiDynamicApiRouter {
  private endpoints = new Map<string, ServiceEndpoint>()
  private rules = new Map<string, RouteRule>()
  private healthMap = new Map<string, HealthStatus>()
  private roundRobinIndex = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerEndpoint(endpoint: ServiceEndpoint): void {
    this.endpoints.set(endpoint.endpointId, endpoint)
  }

  registerRule(rule: RouteRule): void {
    this.rules.set(rule.ruleId, rule)
    this.roundRobinIndex.set(rule.ruleId, 0)
    this.appendAudit('rule.register', rule.ruleId, { pathPattern: rule.pathPattern, strategy: rule.strategy })
  }

  updateHealth(status: HealthStatus): void {
    this.healthMap.set(status.endpointId, status)
  }

  route(ruleId: string): RoutingDecision {
    const rule = this.rules.get(ruleId)
    if (!rule) throw new Error(`Unknown rule: ${ruleId}`)

    const candidates = [...this.endpoints.values()].filter((e) => e.serviceId === rule.serviceId)
    if (candidates.length === 0) throw new Error(`No endpoints for service: ${rule.serviceId}`)

    // Filter unhealthy endpoints
    const healthy = candidates.filter((ep) => {
      const h = this.healthMap.get(ep.endpointId)
      return !h || h.health !== 'UNHEALTHY'
    })

    const pool = healthy.length > 0 ? healthy : candidates
    const fallbackUsed = healthy.length === 0

    let selected: ServiceEndpoint

    if (rule.strategy === 'LATENCY') {
      const withLatency = pool.map((ep) => ({
        ep,
        latency: this.healthMap.get(ep.endpointId)?.latencyMs ?? Infinity,
      }))
      withLatency.sort((a, b) => a.latency - b.latency)
      selected = withLatency[0]!.ep
      return this.makeDecision(ruleId, selected.endpointId, 'LATENCY 최적 경로', fallbackUsed)
    }

    if (rule.strategy === 'WEIGHTED') {
      const total = pool.reduce((s, ep) => s + ep.weight, 0)
      let rand = Math.floor(Date.now() % total)
      let weightSelected = pool[0]!
      for (const ep of pool) {
        if (rand < ep.weight) { weightSelected = ep; break }
        rand -= ep.weight
      }
      return this.makeDecision(ruleId, weightSelected.endpointId, 'WEIGHTED 선택', fallbackUsed)
    }

    if (rule.strategy === 'LEAST_CONN') {
      selected = pool[0]!  // simplified: first healthy in absence of real conn tracking
      return this.makeDecision(ruleId, selected.endpointId, 'LEAST_CONN 선택', fallbackUsed)
    }

    // ROUND_ROBIN (default)
    const idx = (this.roundRobinIndex.get(ruleId) ?? 0) % pool.length
    selected = pool[idx]!
    this.roundRobinIndex.set(ruleId, idx + 1)
    return this.makeDecision(ruleId, selected.endpointId, 'ROUND_ROBIN 순환', fallbackUsed)
  }

  private makeDecision(ruleId: string, endpointId: string, reason: string, fallbackUsed: boolean): RoutingDecision {
    const decision: RoutingDecision = { ruleId, selectedEndpoint: endpointId, reason, fallbackUsed }
    this.appendAudit('route.decision', ruleId, { selectedEndpoint: endpointId, reason, fallbackUsed })
    return decision
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, ruleId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ruleId, detail })
  }
}
