// Design Ref: §R527 — AI기반 실시간 서비스 메시 최적화 v3
// Plan SC: SVC-AI-ADV-R527-SC01

export type TrafficPolicy = 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' | 'WEIGHTED'
export type OptimizationTarget = 'LATENCY' | 'THROUGHPUT' | 'COST' | 'RELIABILITY'

export interface MeshEndpoint {
  endpointId: string
  serviceId: string
  host: string
  port: number
  weight: number           // 현재 가중치 (0..100)
  avgLatencyMs: number
  errorRatePct: number
  activeConnections: number
  cpuUsagePct: number
}

export interface TrafficRoute {
  routeId: string
  sourceService: string
  targetService: string
  currentPolicy: TrafficPolicy
  endpoints: MeshEndpoint[]
}

export interface RouteOptimization {
  routeId: string
  sourceService: string
  targetService: string
  currentPolicy: TrafficPolicy
  recommendedPolicy: TrafficPolicy
  weightAdjustments: Array<{ endpointId: string; currentWeight: number; recommendedWeight: number }>
  expectedLatencyReductionMs: number
  reason: string
}

export interface MeshOptimizationReport {
  totalRoutes: number
  optimizations: RouteOptimization[]
  highLatencyRoutes: string[]
  highErrorRoutes: string[]
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  routeId: string
  detail: Record<string, unknown>
}

export class ServiceMeshOptimizerV3 {
  private routes = new Map<string, TrafficRoute>()
  private auditLog: AuditEntry[] = []

  registerRoute(route: TrafficRoute): void {
    this.routes.set(route.routeId, route)
    this.appendAudit('route.register', route.routeId, { source: route.sourceService, target: route.targetService })
  }

  optimize(target: OptimizationTarget = 'LATENCY'): MeshOptimizationReport {
    const allRoutes = Array.from(this.routes.values())
    this.appendAudit('mesh.optimize', 'system', { routeCount: allRoutes.length, target })

    const optimizations: RouteOptimization[] = []
    const highLatencyRoutes: string[] = []
    const highErrorRoutes: string[] = []
    const recommendations: string[] = []

    for (const route of allRoutes) {
      const endpoints = route.endpoints
      if (endpoints.length === 0) continue

      const avgLatency = endpoints.reduce((s, e) => s + e.avgLatencyMs, 0) / endpoints.length
      const avgError = endpoints.reduce((s, e) => s + e.errorRatePct, 0) / endpoints.length

      if (avgLatency > 500) highLatencyRoutes.push(route.routeId)
      if (avgError > 5) highErrorRoutes.push(route.routeId)

      // 지연/처리량 최적화: 지연 낮은 엔드포인트에 더 높은 가중치
      const sortedByLatency = [...endpoints].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
      const totalEndpoints = sortedByLatency.length
      const weightAdjustments = sortedByLatency.map((ep, idx) => {
        // 지연이 낮을수록 높은 가중치: 역순 가중치 배분
        const recommendedWeight = Math.round(((totalEndpoints - idx) / totalEndpoints) * 100 / (totalEndpoints / 2))
        return { endpointId: ep.endpointId, currentWeight: ep.weight, recommendedWeight: Math.min(100, recommendedWeight) }
      })

      const bestLatency = sortedByLatency[0]?.avgLatencyMs ?? 0
      const expectedLatencyReductionMs = Math.max(0, Math.round(avgLatency - bestLatency))

      // 오류율 높은 엔드포인트가 있으면 WEIGHTED 정책 추천
      const recommendedPolicy: TrafficPolicy =
        avgError > 5 ? 'LEAST_CONN'
          : target === 'LATENCY' ? 'WEIGHTED'
          : target === 'THROUGHPUT' ? 'LEAST_CONN'
          : 'ROUND_ROBIN'

      if (recommendedPolicy !== route.currentPolicy || expectedLatencyReductionMs > 50) {
        optimizations.push({
          routeId: route.routeId,
          sourceService: route.sourceService,
          targetService: route.targetService,
          currentPolicy: route.currentPolicy,
          recommendedPolicy,
          weightAdjustments,
          expectedLatencyReductionMs,
          reason: `${target} 최적화 — ${recommendedPolicy} 정책으로 전환 권장`,
        })
      }
    }

    if (highLatencyRoutes.length > 0) {
      recommendations.push(`고지연 라우트 ${highLatencyRoutes.length}개 — 엔드포인트 수평 확장 검토`)
    }
    if (highErrorRoutes.length > 0) {
      recommendations.push(`고오류 라우트 ${highErrorRoutes.length}개 — LEAST_CONN 정책으로 전환 권장`)
    }

    return { totalRoutes: allRoutes.length, optimizations, highLatencyRoutes, highErrorRoutes, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, routeId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, routeId, detail })
  }
}
