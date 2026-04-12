/**
 * AI 기반 카오스 엔지니어링 — SVC-AI-ADV-R139
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R139/SVC-AI-ADV-R139.plan.md
 * Plan SC: FR-R139.1 ~ FR-R139.6
 *
 * 시스템 취약점 자동 탐지 → 카오스 실험 자동 설계.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type FaultType =
  | 'network-delay'
  | 'network-loss'
  | 'pod-kill'
  | 'cpu-stress'
  | 'memory-stress'
  | 'disk-fill'
  | 'dns-error'

export interface ServiceProfile {
  name: string
  replicas: number
  hasPdb: boolean           // PodDisruptionBudget
  hasCircuitBreaker: boolean
  hasRetry: boolean
  sloTargetMs: number       // SLO latency target
  grade: DataGrade
}

export interface ChaosExperiment {
  id: string
  targetService: string
  faultType: FaultType
  intensity: 'LOW' | 'MEDIUM' | 'HIGH'
  durationSeconds: number
  hypothesis: string
  successCriteria: string
  rollbackTrigger: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface VulnerabilityReport {
  service: string
  vulnerabilities: string[]
  experiments: ChaosExperiment[]
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

let experimentCounter = 0

export class ChaosEngineeringAi {
  private readonly services = new Map<string, ServiceProfile>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] { return this.auditLog }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R139.1
  registerService(profile: ServiceProfile): void {
    if (profile.grade === DataGrade.C || profile.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${profile.grade}등급 서비스 분석 금지 (N2SF N-05)`)
    }
    this.services.set(profile.name, profile)
    this.audit('registerService', { name: profile.name })
  }

  // Plan SC: FR-R139.2 — detect vulnerabilities from profile
  private detectVulnerabilities(p: ServiceProfile): string[] {
    const vulns: string[] = []
    if (!p.hasPdb) vulns.push('PodDisruptionBudget 미설정 — 롤링 업데이트 시 가용성 위험')
    if (!p.hasCircuitBreaker) vulns.push('서킷 브레이커 미적용 — 종속 서비스 장애 전파 위험')
    if (!p.hasRetry) vulns.push('재시도 정책 미적용 — 일시적 오류 복구 불가')
    if (p.replicas < 2) vulns.push('단일 레플리카 — SPOF 위험')
    return vulns
  }

  // Plan SC: FR-R139.3 — design experiments based on vulnerabilities
  private designExperiments(p: ServiceProfile, _vulns: string[]): ChaosExperiment[] {
    const experiments: ChaosExperiment[] = []

    if (!p.hasCircuitBreaker) {
      experiments.push({
        id: `exp-${++experimentCounter}`,
        targetService: p.name,
        faultType: 'network-delay',
        intensity: 'MEDIUM',
        durationSeconds: 60,
        hypothesis: `서킷 브레이커 없이 ${p.sloTargetMs}ms SLO 유지 가능한가?`,
        successCriteria: `오류율 < 5%, p99 레이턴시 < ${p.sloTargetMs * 2}ms`,
        rollbackTrigger: `오류율 > 20% 또는 p99 > ${p.sloTargetMs * 5}ms`,
        riskLevel: 'MEDIUM',
      })
    }

    if (p.replicas < 2) {
      experiments.push({
        id: `exp-${++experimentCounter}`,
        targetService: p.name,
        faultType: 'pod-kill',
        intensity: 'LOW',
        durationSeconds: 30,
        hypothesis: '단일 파드 종료 시 서비스 복구 시간은?',
        successCriteria: '30초 내 서비스 재개',
        rollbackTrigger: '서비스 60초 이상 비가용',
        riskLevel: 'HIGH',
      })
    }

    if (!p.hasRetry) {
      experiments.push({
        id: `exp-${++experimentCounter}`,
        targetService: p.name,
        faultType: 'network-loss',
        intensity: 'LOW',
        durationSeconds: 30,
        hypothesis: '패킷 손실 10%에서 성공률은?',
        successCriteria: '요청 성공률 > 95%',
        rollbackTrigger: '성공률 < 80%',
        riskLevel: 'MEDIUM',
      })
    }

    // Always include CPU stress test if replicas >= 2
    if (p.replicas >= 2) {
      experiments.push({
        id: `exp-${++experimentCounter}`,
        targetService: p.name,
        faultType: 'cpu-stress',
        intensity: 'MEDIUM',
        durationSeconds: 120,
        hypothesis: 'CPU 90% 부하 시 HPA 자동 스케일 아웃 동작 확인',
        successCriteria: '3분 내 레플리카 증가, SLO 유지',
        rollbackTrigger: `p99 > ${p.sloTargetMs * 3}ms`,
        riskLevel: 'LOW',
      })
    }

    return experiments
  }

  // Plan SC: FR-R139.4
  private overallRisk(vulns: string[], replicas: number): VulnerabilityReport['overallRisk'] {
    if (vulns.length >= 3 && replicas < 2) return 'CRITICAL'
    if (vulns.length >= 3) return 'HIGH'
    if (vulns.length >= 2) return 'MEDIUM'
    return 'LOW'
  }

  // Plan SC: FR-R139.5, FR-R139.6
  analyzeService(name: string): VulnerabilityReport {
    const profile = this.services.get(name)
    if (!profile) throw new Error(`service not registered: ${name}`)
    const vulnerabilities = this.detectVulnerabilities(profile)
    const experiments = this.designExperiments(profile, vulnerabilities)
    const overallRisk = this.overallRisk(vulnerabilities, profile.replicas)
    this.audit('analyzeService', { name, vulns: vulnerabilities.length, experiments: experiments.length })
    return { service: name, vulnerabilities, experiments, overallRisk }
  }

  analyzeAll(): VulnerabilityReport[] {
    const reports = [...this.services.keys()].map(n => this.analyzeService(n))
    this.audit('analyzeAll', { count: reports.length })
    return reports
  }
}
