// Design Ref: §R388 — AI기반 마이크로서비스 종속성 최적화 v2
// Plan SC: SC-R388

export interface ServiceNode {
  serviceId: string
  serviceName: string
  tier: 'FRONTEND' | 'BACKEND' | 'DATA' | 'INFRA'
  criticality: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ServiceDependency {
  fromServiceId: string
  toServiceId: string
  callFrequencyPerMin: number
  avgLatencyMs: number
  isSynchronous: boolean
}

export type DependencyIssue = 'CIRCULAR' | 'HIGH_COUPLING' | 'CROSS_TIER' | 'SYNC_BOTTLENECK'

export interface DependencyOptimizationReport {
  totalServices: number
  totalDependencies: number
  issues: { issueType: DependencyIssue; affectedServices: string[]; description: string; recommendation: string }[]
  couplingScore: number
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class MicroserviceDependencyOptimizerV2 {
  private services = new Map<string, ServiceNode>()
  private dependencies: ServiceDependency[] = []
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceNode): void {
    this.services.set(service.serviceId, service)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: service.serviceId })
  }

  addDependency(dep: ServiceDependency): void {
    this.dependencies.push(dep)
    this.auditLog.push({ action: 'dependency.add', timestamp: new Date().toISOString(), detail: `${dep.fromServiceId}->${dep.toServiceId}` })
  }

  optimize(): DependencyOptimizationReport {
    const issues: DependencyOptimizationReport['issues'] = []

    // 순환 의존성 탐지 (A→B, B→A)
    for (const dep of this.dependencies) {
      const reverse = this.dependencies.find((d) => d.fromServiceId === dep.toServiceId && d.toServiceId === dep.fromServiceId)
      if (reverse) {
        const pair = [dep.fromServiceId, dep.toServiceId].sort().join(',')
        if (!issues.some((i) => i.issueType === 'CIRCULAR' && i.affectedServices.join(',') === pair)) {
          issues.push({
            issueType: 'CIRCULAR',
            affectedServices: [dep.fromServiceId, dep.toServiceId],
            description: `순환 의존성: ${dep.fromServiceId} ↔ ${dep.toServiceId}`,
            recommendation: '이벤트 기반 비동기 통신으로 전환하여 순환 제거',
          })
        }
      }
    }

    // 고결합 탐지: 단일 서비스에 5개 이상 의존
    const incomingCounts = new Map<string, number>()
    for (const dep of this.dependencies) {
      incomingCounts.set(dep.toServiceId, (incomingCounts.get(dep.toServiceId) ?? 0) + 1)
    }
    for (const [svcId, count] of incomingCounts) {
      if (count >= 5) {
        issues.push({
          issueType: 'HIGH_COUPLING',
          affectedServices: [svcId],
          description: `${svcId}에 ${count}개 서비스 의존 — 고결합 감지`,
          recommendation: 'API Gateway 또는 이벤트 버스 도입으로 결합도 분산',
        })
      }
    }

    // 동기 고빈도 호출 병목 탐지
    const syncBottlenecks = this.dependencies.filter((d) => d.isSynchronous && d.callFrequencyPerMin > 1000)
    for (const dep of syncBottlenecks) {
      issues.push({
        issueType: 'SYNC_BOTTLENECK',
        affectedServices: [dep.fromServiceId, dep.toServiceId],
        description: `동기 고빈도(${dep.callFrequencyPerMin}rpm) 호출: ${dep.fromServiceId}→${dep.toServiceId}`,
        recommendation: '캐싱 또는 비동기 메시지 큐 전환 검토',
      })
    }

    // 결합도 점수: 이슈당 감점
    const couplingScore = Math.max(0, 100 - issues.length * 15)
    const recommendations = issues.map((i) => i.recommendation)

    this.auditLog.push({ action: 'dependency.optimize', timestamp: new Date().toISOString(), detail: `issues=${issues.length}` })
    return {
      totalServices: this.services.size,
      totalDependencies: this.dependencies.length,
      issues,
      couplingScore,
      recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
