// Design Ref: §R274 — AI기반 서비스 메시 자동 구성
// Plan SC: SVC-AI-ADV-R274-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type MeshPolicy = 'MTLS_STRICT' | 'MTLS_PERMISSIVE' | 'NONE'
export type LoadBalancingPolicy = 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' | 'CONSISTENT_HASH'
export type RetryPolicy = 'AGGRESSIVE' | 'MODERATE' | 'CONSERVATIVE' | 'NONE'

export interface MeshServiceConfig {
  serviceId: string
  name: string
  namespace: string
  replicas: number
  avgLatencyMs: number
  errorRate: number  // 0~1
  requestsPerSecond: number
}

export interface MeshConfiguration {
  serviceId: string
  recommendedMtlsPolicy: MeshPolicy
  recommendedLbPolicy: LoadBalancingPolicy
  recommendedRetryPolicy: RetryPolicy
  timeoutMs: number
  maxRetries: number
  rateLimitRps: number
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceMeshConfiguratorAi {
  private services = new Map<string, MeshServiceConfig>()
  private auditLog: AuditEntry[] = []

  registerService(config: MeshServiceConfig): void {
    this.services.set(config.serviceId, config)
    this.appendAudit('service.register', config.serviceId, { name: config.name, namespace: config.namespace })
  }

  configure(serviceId: string): MeshConfiguration {
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`Unknown service: ${serviceId}`)

    // mTLS 정책: 공공기관 서비스는 STRICT 권고
    const recommendedMtlsPolicy: MeshPolicy = svc.namespace === 'public' ? 'MTLS_PERMISSIVE' : 'MTLS_STRICT'

    // 부하 분산: 고지연이면 LEAST_CONN, 높은 RPS면 CONSISTENT_HASH
    let recommendedLbPolicy: LoadBalancingPolicy = 'ROUND_ROBIN'
    if (svc.avgLatencyMs > 300) recommendedLbPolicy = 'LEAST_CONN'
    else if (svc.requestsPerSecond > 1000) recommendedLbPolicy = 'CONSISTENT_HASH'

    // 재시도 정책: 에러율 기반
    let recommendedRetryPolicy: RetryPolicy = 'NONE'
    let maxRetries = 0
    if (svc.errorRate > 0.1) {
      recommendedRetryPolicy = 'AGGRESSIVE'
      maxRetries = 5
    } else if (svc.errorRate > 0.05) {
      recommendedRetryPolicy = 'MODERATE'
      maxRetries = 3
    } else if (svc.errorRate > 0.01) {
      recommendedRetryPolicy = 'CONSERVATIVE'
      maxRetries = 1
    }

    // 타임아웃: 평균 지연의 3배 (최소 1000ms)
    const timeoutMs = Math.max(1000, svc.avgLatencyMs * 3)

    // Rate Limit: 실제 RPS의 120%
    const rateLimitRps = Math.round(svc.requestsPerSecond * 1.2)

    const reasons: string[] = []
    if (recommendedLbPolicy !== 'ROUND_ROBIN') reasons.push(`LB: ${recommendedLbPolicy} (지연/RPS 기반)`)
    if (recommendedRetryPolicy !== 'NONE') reasons.push(`Retry: ${recommendedRetryPolicy} (에러율 ${Math.round(svc.errorRate * 100)}%)`)
    const reason = reasons.length > 0 ? reasons.join('; ') : '기본 메시 구성 적용'

    this.appendAudit('mesh.configure', serviceId, { mtlsPolicy: recommendedMtlsPolicy, lbPolicy: recommendedLbPolicy, retryPolicy: recommendedRetryPolicy })

    return {
      serviceId,
      recommendedMtlsPolicy,
      recommendedLbPolicy,
      recommendedRetryPolicy,
      timeoutMs,
      maxRetries,
      rateLimitRps,
      reason,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
