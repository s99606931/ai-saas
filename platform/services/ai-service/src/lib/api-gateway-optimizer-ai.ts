// Design Ref: §R367 — AI기반 자동 API 게이트웨이 최적화
// Plan SC: SVC-AI-ADV-R367-SC01

export type RouteStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED'
export type OptimizationAction = 'CACHE_ENABLE' | 'RATE_LIMIT_ADJUST' | 'CIRCUIT_BREAK' | 'ROUTE_REMOVE' | 'NONE'

export interface GatewayRoute {
  routeId: string
  path: string
  method: string
  backendUrl: string
  status: RouteStatus
  rateLimit: number  // requests per minute
  cacheEnabled: boolean
  timeoutMs: number
}

export interface RouteMetrics {
  routeId: string
  requestsPerMin: number
  avgLatencyMs: number
  errorRate: number  // 0..1
  cacheHitRate: number  // 0..1
  timestamp: number
}

export interface OptimizationPlan {
  routeId: string
  action: OptimizationAction
  reason: string
  suggestedRateLimit?: number
  suggestedTimeoutMs?: number
}

interface AuditEntry {
  timestamp: string
  action: string
  routeId: string
  detail: Record<string, unknown>
}

export class ApiGatewayOptimizerAI {
  private routes = new Map<string, GatewayRoute>()
  private metricsHistory = new Map<string, RouteMetrics[]>()
  private auditLog: AuditEntry[] = []

  registerRoute(route: GatewayRoute): void {
    this.routes.set(route.routeId, route)
    this.appendAudit('route.register', route.routeId, { path: route.path, status: route.status })
  }

  ingestMetrics(metrics: RouteMetrics): void {
    if (!this.routes.has(metrics.routeId)) {
      throw new Error(`Unknown route: ${metrics.routeId}`)
    }
    const history = this.metricsHistory.get(metrics.routeId) ?? []
    history.push(metrics)
    this.metricsHistory.set(metrics.routeId, history)
  }

  optimize(routeId: string): OptimizationPlan {
    const route = this.routes.get(routeId)
    if (!route) throw new Error(`Unknown route: ${routeId}`)

    const history = this.metricsHistory.get(routeId) ?? []

    if (history.length === 0) {
      this.appendAudit('route.optimize', routeId, { action: 'NONE', reason: '메트릭 없음' })
      return { routeId, action: 'NONE', reason: '메트릭 데이터 없음' }
    }

    // history.length > 0 guaranteed by early return above
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const latest = history[history.length - 1]!

    // 회로 차단: 에러율 30% 초과
    if (latest.errorRate >= 0.3) {
      this.appendAudit('route.optimize', routeId, { action: 'CIRCUIT_BREAK', errorRate: latest.errorRate })
      return { routeId, action: 'CIRCUIT_BREAK', reason: `에러율 ${(latest.errorRate * 100).toFixed(0)}% 초과 — 회로 차단 권고` }
    }

    // 레이트 리밋 조정: 현재 요청량이 리밋의 90% 초과
    if (latest.requestsPerMin > route.rateLimit * 0.9) {
      const suggestedRateLimit = Math.ceil(route.rateLimit * 1.5)
      this.appendAudit('route.optimize', routeId, { action: 'RATE_LIMIT_ADJUST', current: route.rateLimit, suggested: suggestedRateLimit })
      return { routeId, action: 'RATE_LIMIT_ADJUST', reason: `요청량 ${latest.requestsPerMin}rpm이 리밋 ${route.rateLimit}의 90% 초과`, suggestedRateLimit }
    }

    // 캐시 활성화 권고: 캐시 미사용 + 레이턴시 높음
    if (!route.cacheEnabled && latest.avgLatencyMs >= 500) {
      this.appendAudit('route.optimize', routeId, { action: 'CACHE_ENABLE', avgLatencyMs: latest.avgLatencyMs })
      return { routeId, action: 'CACHE_ENABLE', reason: `평균 레이턴시 ${latest.avgLatencyMs}ms — 캐시 활성화로 성능 개선 권고` }
    }

    // DEPRECATED + 트래픽 없음: 라우트 제거 권고
    if (route.status === 'DEPRECATED' && latest.requestsPerMin === 0) {
      this.appendAudit('route.optimize', routeId, { action: 'ROUTE_REMOVE', status: route.status })
      return { routeId, action: 'ROUTE_REMOVE', reason: 'DEPRECATED 상태 + 트래픽 없음 — 라우트 제거 권고' }
    }

    this.appendAudit('route.optimize', routeId, { action: 'NONE' })
    return { routeId, action: 'NONE', reason: '최적화 불필요' }
  }

  optimizeAll(): OptimizationPlan[] {
    return Array.from(this.routes.keys()).map((id) => this.optimize(id))
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, routeId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, routeId, detail })
  }
}
