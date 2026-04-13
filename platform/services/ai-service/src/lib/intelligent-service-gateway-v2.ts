// Design Ref: §R317 — AI기반 지능형 서비스 게이트웨이 v2
// Plan SC: SC-R317

export interface GatewayRoute {
  routeId: string
  path: string
  targetServiceId: string
  authRequired: boolean
  rateLimit: number
  dataGrade: 'O' | 'S' | 'C'
  timeoutMs: number
}

export interface GatewayRequest {
  requestId: string
  routeId: string
  clientId: string
  timestamp: number
  payload?: unknown
}

export type GatewayDecision = 'ALLOW' | 'DENY' | 'THROTTLE' | 'BLOCK_DATA_GRADE'

export interface GatewayResult {
  requestId: string
  decision: GatewayDecision
  reason: string
  appliedPolicies: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class IntelligentServiceGatewayV2 {
  private routes = new Map<string, GatewayRoute>()
  private requestCounts = new Map<string, number[]>()
  private blockedClients = new Set<string>()
  private auditLog: AuditEntry[] = []

  registerRoute(route: GatewayRoute): void {
    this.routes.set(route.routeId, route)
    this.auditLog.push({ action: 'route.register', timestamp: new Date().toISOString(), detail: route.routeId })
  }

  blockClient(clientId: string): void {
    this.blockedClients.add(clientId)
    this.auditLog.push({ action: 'client.block', timestamp: new Date().toISOString(), detail: clientId })
  }

  process(request: GatewayRequest): GatewayResult {
    const route = this.routes.get(request.routeId)
    if (!route) throw new Error(`Route not found: ${request.routeId}`)

    const appliedPolicies: string[] = []

    // 차단된 클라이언트
    if (this.blockedClients.has(request.clientId)) {
      this.audit('gateway.process', `${request.requestId}:BLOCK_CLIENT`)
      return { requestId: request.requestId, decision: 'DENY', reason: '차단된 클라이언트', appliedPolicies: ['CLIENT_BLOCK'] }
    }

    // N2SF: C/S 등급 외부 전송 차단
    if (route.dataGrade === 'C' || route.dataGrade === 'S') {
      appliedPolicies.push('DATA_GRADE_POLICY')
      // 내부 서비스만 허용 (외부 AI API 전송 금지)
      if (request.payload !== undefined) {
        this.audit('gateway.process', `${request.requestId}:BLOCK_DATA_GRADE`)
        return { requestId: request.requestId, decision: 'BLOCK_DATA_GRADE', reason: `${route.dataGrade}등급 데이터 외부 전송 차단 (N2SF N-05)`, appliedPolicies }
      }
    }

    // Rate Limiting
    const now = request.timestamp
    const windowKey = `${request.clientId}:${request.routeId}`
    const windowMs = 60_000
    const existing = (this.requestCounts.get(windowKey) ?? []).filter((t) => now - t < windowMs)
    existing.push(now)
    this.requestCounts.set(windowKey, existing)

    if (existing.length > route.rateLimit) {
      appliedPolicies.push('RATE_LIMIT')
      this.audit('gateway.process', `${request.requestId}:THROTTLE`)
      return { requestId: request.requestId, decision: 'THROTTLE', reason: `Rate limit 초과 (${route.rateLimit}req/min)`, appliedPolicies }
    }

    appliedPolicies.push('ALLOW')
    this.audit('gateway.process', `${request.requestId}:ALLOW`)
    return { requestId: request.requestId, decision: 'ALLOW', reason: '정상 처리', appliedPolicies }
  }

  private audit(action: string, detail: string): void {
    this.auditLog.push({ action, timestamp: new Date().toISOString(), detail })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
