// Design Ref: §R314 — AI기반 서비스 성숙도 자동 측정
// Plan SC: SC-R314

export interface ServiceProfile {
  serviceId: string
  name: string
  uptimePercent: number
  avgResponseMs: number
  deployFrequencyPerMonth: number
  mttrMinutes: number
  testCoveragePercent: number
  hasMonitoring: boolean
  hasAlerts: boolean
  hasCiCd: boolean
}

export type MaturityLevel = 'L1_INITIAL' | 'L2_REPEATABLE' | 'L3_DEFINED' | 'L4_MANAGED' | 'L5_OPTIMIZING'

export interface MaturityAssessment {
  serviceId: string
  maturityLevel: MaturityLevel
  maturityScore: number
  strengths: string[]
  improvements: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceMaturityAssessorAi {
  private services = new Map<string, ServiceProfile>()
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceProfile): void {
    this.services.set(service.serviceId, service)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: service.serviceId })
  }

  assess(serviceId: string): MaturityAssessment {
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`Service not found: ${serviceId}`)

    let score = 0
    const strengths: string[] = []
    const improvements: string[] = []

    // 가용성 (20점)
    if (svc.uptimePercent >= 99.9) { score += 20; strengths.push('고가용성 달성 (≥99.9%)') }
    else if (svc.uptimePercent >= 99.0) { score += 14 }
    else if (svc.uptimePercent >= 95.0) { score += 8 }
    else { improvements.push(`가용성 개선 필요 (현재 ${svc.uptimePercent}%)`) }

    // 응답 시간 (20점)
    if (svc.avgResponseMs <= 100) { score += 20; strengths.push('빠른 응답 시간 (≤100ms)') }
    else if (svc.avgResponseMs <= 300) { score += 14 }
    else if (svc.avgResponseMs <= 1000) { score += 8 }
    else { improvements.push(`응답 시간 개선 필요 (현재 ${svc.avgResponseMs}ms)`) }

    // 배포 빈도 (20점)
    if (svc.deployFrequencyPerMonth >= 20) { score += 20; strengths.push('고빈도 배포 (≥20회/월)') }
    else if (svc.deployFrequencyPerMonth >= 8) { score += 14 }
    else if (svc.deployFrequencyPerMonth >= 2) { score += 8 }
    else { improvements.push('배포 자동화 도입 필요') }

    // MTTR (20점)
    if (svc.mttrMinutes <= 15) { score += 20; strengths.push('빠른 복구 시간 (≤15분)') }
    else if (svc.mttrMinutes <= 60) { score += 14 }
    else if (svc.mttrMinutes <= 240) { score += 8 }
    else { improvements.push(`복구 시간 단축 필요 (현재 ${svc.mttrMinutes}분)`) }

    // 모니터링/알림/CI-CD (각 5점, 테스트 커버리지 10점)
    if (svc.hasMonitoring) score += 5; else improvements.push('모니터링 도입 필요')
    if (svc.hasAlerts) score += 5; else improvements.push('알림 설정 필요')
    if (svc.hasCiCd) score += 5; else improvements.push('CI/CD 파이프라인 구축 필요')
    if (svc.testCoveragePercent >= 80) { score += 5; strengths.push('높은 테스트 커버리지') }

    let maturityLevel: MaturityLevel
    if (score >= 90) maturityLevel = 'L5_OPTIMIZING'
    else if (score >= 75) maturityLevel = 'L4_MANAGED'
    else if (score >= 55) maturityLevel = 'L3_DEFINED'
    else if (score >= 35) maturityLevel = 'L2_REPEATABLE'
    else maturityLevel = 'L1_INITIAL'

    this.auditLog.push({ action: 'maturity.assess', timestamp: new Date().toISOString(), detail: `${serviceId}:${maturityLevel}` })
    return { serviceId, maturityLevel, maturityScore: score, strengths, improvements }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
