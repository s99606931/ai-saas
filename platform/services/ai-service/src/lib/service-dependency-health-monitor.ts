// Design Ref: §R369 — AI기반 서비스 의존성 건전성 모니터
// Plan SC: SVC-AI-ADV-R369-SC01

export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN'
export type DependencyRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ServiceNode {
  serviceId: string
  name: string
  dependencies: string[]  // serviceId list
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface HealthSnapshot {
  serviceId: string
  status: ServiceStatus
  responseTimeMs: number
  errorRate: number  // 0..1
  timestamp: number
}

export interface DependencyHealthReport {
  serviceId: string
  overallRisk: DependencyRisk
  affectedDownstream: string[]
  criticalPath: boolean
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceDependencyHealthMonitor {
  private services = new Map<string, ServiceNode>()
  private healthSnapshots = new Map<string, HealthSnapshot>()
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceNode): void {
    this.services.set(service.serviceId, service)
    this.appendAudit('service.register', service.serviceId, { name: service.name, deps: service.dependencies.length })
  }

  updateHealth(snapshot: HealthSnapshot): void {
    if (!this.services.has(snapshot.serviceId)) {
      throw new Error(`Unknown service: ${snapshot.serviceId}`)
    }
    this.healthSnapshots.set(snapshot.serviceId, snapshot)
    this.appendAudit('health.update', snapshot.serviceId, { status: snapshot.status, errorRate: snapshot.errorRate })
  }

  analyze(serviceId: string): DependencyHealthReport {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    const snapshot = this.healthSnapshots.get(serviceId)
    const recommendations: string[] = []

    // 다운스트림 영향 분석 (이 서비스에 의존하는 서비스들)
    const affectedDownstream: string[] = []
    for (const [id, node] of this.services) {
      if (node.dependencies.includes(serviceId)) {
        affectedDownstream.push(id)
      }
    }

    // 크리티컬 패스: 이 서비스에 의존하는 CRITICAL/HIGH 서비스가 있는 경우
    const criticalPath = affectedDownstream.some((downId) => {
      const downService = this.services.get(downId)
      return downService?.criticality === 'CRITICAL' || downService?.criticality === 'HIGH'
    })

    // 리스크 계산
    let riskScore = 0
    if (snapshot) {
      if (snapshot.status === 'DOWN') riskScore += 40
      else if (snapshot.status === 'DEGRADED') riskScore += 20

      if (snapshot.errorRate >= 0.2) riskScore += 30
      else if (snapshot.errorRate >= 0.05) riskScore += 15

      if (snapshot.responseTimeMs >= 2000) riskScore += 20
      else if (snapshot.responseTimeMs >= 1000) riskScore += 10
    }

    if (service.criticality === 'CRITICAL') riskScore += 10
    if (affectedDownstream.length >= 3) riskScore += 10
    if (criticalPath) riskScore += 10

    const overallRisk: DependencyRisk =
      riskScore >= 70 ? 'CRITICAL'
        : riskScore >= 40 ? 'HIGH'
        : riskScore >= 20 ? 'MEDIUM'
        : 'LOW'

    if (snapshot?.status === 'DOWN') {
      recommendations.push('즉시 장애 대응팀 알림 및 서비스 재시작 시도')
    }
    if (snapshot && snapshot.errorRate >= 0.2) {
      recommendations.push('에러율이 높습니다. 로그 분석 및 회로 차단 패턴 적용 검토')
    }
    if (affectedDownstream.length > 0) {
      recommendations.push(`${affectedDownstream.length}개 다운스트림 서비스 영향 — 의존 서비스 상태 점검 필요`)
    }
    if (criticalPath) {
      recommendations.push('크리티컬 패스 경유 서비스 — 최우선 복구 대상')
    }

    this.appendAudit('service.analyze', serviceId, { overallRisk, affectedDownstream: affectedDownstream.length })

    return { serviceId, overallRisk, affectedDownstream, criticalPath, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
