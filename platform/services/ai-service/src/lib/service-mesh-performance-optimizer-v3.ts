// Design Ref: §R617 — AI기반 서비스 메시 성능 최적화 v3
// Plan SC: SVC-AI-ADV-R617-SC01

export type MeshIssueType = 'HIGH_LATENCY' | 'LOW_THROUGHPUT' | 'SIDECAR_OVERHEAD'
export type TrafficPolicy = 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' | 'RING_HASH'

export interface MeshService {
  serviceId: string
  name: string
  sidecarEnabled: boolean
  sidecarCpuPct: number     // sidecar CPU overhead %
  sidecarMemoryMb: number   // sidecar memory overhead MB
  avgLatencyMs: number
  throughputRps: number     // requests per second
  targetLatencyMs: number
  targetThroughputRps: number
}

export interface MeshIssue {
  issueId: string
  serviceId: string
  issueType: MeshIssueType
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  detail: string
}

export interface SidecarOptimization {
  serviceId: string
  name: string
  currentCpuPct: number
  recommendedCpuPct: number
  currentMemoryMb: number
  recommendedMemoryMb: number
  trafficPolicy: TrafficPolicy
}

export interface MeshOptimizationResult {
  issues: MeshIssue[]
  sidecarOptimizations: SidecarOptimization[]
  trafficPolicyRecommendations: { serviceId: string; policy: TrafficPolicy; reason: string }[]
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceMeshPerformanceOptimizerV3 {
  private services = new Map<string, MeshService>()
  private auditLog: AuditEntry[] = []

  registerService(service: MeshService): void {
    this.services.set(service.serviceId, service)
    this.appendAudit('service.register', service.serviceId, { name: service.name, sidecarEnabled: service.sidecarEnabled })
  }

  analyze(): MeshIssue[] {
    const issues: MeshIssue[] = []
    let issueCounter = 0

    for (const svc of this.services.values()) {
      if (svc.avgLatencyMs > svc.targetLatencyMs) {
        issueCounter++
        issues.push({
          issueId: `MESH-ISSUE-${issueCounter}`,
          serviceId: svc.serviceId,
          issueType: 'HIGH_LATENCY',
          severity: svc.avgLatencyMs > svc.targetLatencyMs * 2 ? 'HIGH' : 'MEDIUM',
          detail: `평균 지연 ${svc.avgLatencyMs}ms — 목표 ${svc.targetLatencyMs}ms 초과`,
        })
      }

      if (svc.throughputRps < svc.targetThroughputRps) {
        issueCounter++
        issues.push({
          issueId: `MESH-ISSUE-${issueCounter}`,
          serviceId: svc.serviceId,
          issueType: 'LOW_THROUGHPUT',
          severity: svc.throughputRps < svc.targetThroughputRps * 0.5 ? 'HIGH' : 'MEDIUM',
          detail: `처리량 ${svc.throughputRps}rps — 목표 ${svc.targetThroughputRps}rps 미달`,
        })
      }

      if (svc.sidecarEnabled && svc.sidecarCpuPct > 10) {
        issueCounter++
        issues.push({
          issueId: `MESH-ISSUE-${issueCounter}`,
          serviceId: svc.serviceId,
          issueType: 'SIDECAR_OVERHEAD',
          severity: svc.sidecarCpuPct > 20 ? 'HIGH' : 'LOW',
          detail: `사이드카 CPU 오버헤드 ${svc.sidecarCpuPct}% — 튜닝 필요`,
        })
      }
    }

    this.appendAudit('mesh.analyze', 'system', { issueCount: issues.length })
    return issues
  }

  optimize(): MeshOptimizationResult {
    const issues = this.analyze()
    const sidecarOptimizations: SidecarOptimization[] = []
    const trafficPolicyRecommendations: MeshOptimizationResult['trafficPolicyRecommendations'] = []

    for (const svc of this.services.values()) {
      const svcIssues = issues.filter((i) => i.serviceId === svc.serviceId)
      const hasOverhead = svcIssues.some((i) => i.issueType === 'SIDECAR_OVERHEAD')
      const hasHighLatency = svcIssues.some((i) => i.issueType === 'HIGH_LATENCY')
      const hasLowThroughput = svcIssues.some((i) => i.issueType === 'LOW_THROUGHPUT')

      if (svc.sidecarEnabled && (hasOverhead || hasHighLatency)) {
        sidecarOptimizations.push({
          serviceId: svc.serviceId,
          name: svc.name,
          currentCpuPct: svc.sidecarCpuPct,
          recommendedCpuPct: Math.max(5, Math.round(svc.sidecarCpuPct * 0.6)),
          currentMemoryMb: svc.sidecarMemoryMb,
          recommendedMemoryMb: Math.max(64, Math.round(svc.sidecarMemoryMb * 0.7)),
          trafficPolicy: hasLowThroughput ? 'LEAST_CONN' : 'ROUND_ROBIN',
        })
      }

      if (hasLowThroughput) {
        trafficPolicyRecommendations.push({
          serviceId: svc.serviceId,
          policy: 'LEAST_CONN',
          reason: `처리량 ${svc.throughputRps}rps 미달 — 최소연결 정책으로 부하 분산 개선`,
        })
      } else if (hasHighLatency) {
        trafficPolicyRecommendations.push({
          serviceId: svc.serviceId,
          policy: 'LEAST_CONN',
          reason: `지연 ${svc.avgLatencyMs}ms 초과 — 최소연결 정책으로 응답시간 개선`,
        })
      }
    }

    this.appendAudit('mesh.optimize', 'system', {
      sidecarOptimizations: sidecarOptimizations.length,
      policyRecommendations: trafficPolicyRecommendations.length,
    })
    return { issues, sidecarOptimizations, trafficPolicyRecommendations }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
