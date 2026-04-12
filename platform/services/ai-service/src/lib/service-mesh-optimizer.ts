/**
 * AI 기반 서비스 메시 최적화 — SVC-AI-ADV-R138
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R138/SVC-AI-ADV-R138.plan.md
 * Plan SC: FR-R138.1 ~ FR-R138.6
 *
 * Istio/Envoy 트래픽 패턴 분석 → 라우팅 규칙 자동 최적화.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type LbPolicy = 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' | 'PASSTHROUGH'

export interface TrafficSample {
  sourceService: string
  destService: string
  timestamp: string
  latencyMs: number
  errorRate: number   // 0~1
  rps: number
  grade: DataGrade
}

export interface ServiceRoute {
  service: string
  subsets: Array<{ name: string; weight: number }>
  lbPolicy: LbPolicy
  timeoutMs: number
  retryAttempts: number
}

export interface OptimizationRecommendation {
  destService: string
  currentLbPolicy: LbPolicy
  recommendedLbPolicy: LbPolicy
  recommendedTimeoutMs: number
  recommendedRetries: number
  reason: string
  expectedLatencyReductionPercent: number
}

export interface MeshReport {
  generatedAt: string
  recommendations: OptimizationRecommendation[]
  highLatencyRoutes: string[]
  highErrorRoutes: string[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

export class ServiceMeshOptimizer {
  private readonly samples: TrafficSample[] = []
  private readonly routes = new Map<string, ServiceRoute>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] { return this.auditLog }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R138.1
  addTrafficSample(sample: TrafficSample): void {
    if (sample.grade === DataGrade.C || sample.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${sample.grade}등급 트래픽 데이터 수집 금지 (N2SF N-05)`)
    }
    this.samples.push(sample)
    this.audit('addTrafficSample', { dest: sample.destService })
  }

  // Plan SC: FR-R138.2
  registerRoute(route: ServiceRoute): void {
    this.routes.set(route.service, route)
    this.audit('registerRoute', { service: route.service })
  }

  // Plan SC: FR-R138.3 — pick LB policy based on error/latency profile
  private recommendLbPolicy(avgLatency: number, p99Latency: number, avgError: number): LbPolicy {
    if (avgError > 0.05) return 'LEAST_CONN'      // high error → least connections
    if (p99Latency > avgLatency * 3) return 'LEAST_CONN'  // high variance → least conn
    if (avgLatency < 50) return 'ROUND_ROBIN'
    return 'LEAST_CONN'
  }

  // Plan SC: FR-R138.4
  private recommendTimeout(p99Latency: number): number {
    return Math.max(1000, Math.round(p99Latency * 2 / 100) * 100)
  }

  private recommendRetries(avgError: number): number {
    if (avgError > 0.1) return 3
    if (avgError > 0.01) return 2
    return 1
  }

  // Plan SC: FR-R138.5, FR-R138.6
  optimize(): MeshReport {
    if (this.samples.length === 0) throw new Error('트래픽 샘플이 없습니다')

    // Group samples by destService
    const grouped = new Map<string, TrafficSample[]>()
    for (const s of this.samples) {
      if (!grouped.has(s.destService)) grouped.set(s.destService, [])
      grouped.get(s.destService)!.push(s)
    }

    const recommendations: OptimizationRecommendation[] = []
    const highLatencyRoutes: string[] = []
    const highErrorRoutes: string[] = []

    for (const [dest, svcSamples] of grouped.entries()) {
      const latencies = svcSamples.map(s => s.latencyMs).sort((a, b) => a - b)
      const avgLatency = latencies.reduce((s, v) => s + v, 0) / latencies.length
      const p99Latency = latencies[Math.floor(latencies.length * 0.99)] ?? latencies[latencies.length - 1]!
      const avgError = svcSamples.reduce((s, v) => s + v.errorRate, 0) / svcSamples.length

      if (avgLatency > 500) highLatencyRoutes.push(dest)
      if (avgError > 0.05) highErrorRoutes.push(dest)

      const current = this.routes.get(dest)
      const recommendedLb = this.recommendLbPolicy(avgLatency, p99Latency, avgError)
      const recommendedTimeout = this.recommendTimeout(p99Latency)
      const recommendedRetries = this.recommendRetries(avgError)

      if (
        !current ||
        current.lbPolicy !== recommendedLb ||
        current.timeoutMs !== recommendedTimeout ||
        current.retryAttempts !== recommendedRetries
      ) {
        const expectedReduction = recommendedLb === 'LEAST_CONN' && (current?.lbPolicy ?? 'ROUND_ROBIN') === 'ROUND_ROBIN'
          ? 15 : 5
        recommendations.push({
          destService: dest,
          currentLbPolicy: current?.lbPolicy ?? 'ROUND_ROBIN',
          recommendedLbPolicy: recommendedLb,
          recommendedTimeoutMs: recommendedTimeout,
          recommendedRetries,
          reason: `avgLatency=${avgLatency.toFixed(0)}ms, p99=${p99Latency}ms, errorRate=${(avgError * 100).toFixed(1)}%`,
          expectedLatencyReductionPercent: expectedReduction,
        })
      }
    }

    this.audit('optimize', { recommendations: recommendations.length })
    return { generatedAt: new Date().toISOString(), recommendations, highLatencyRoutes, highErrorRoutes }
  }
}
