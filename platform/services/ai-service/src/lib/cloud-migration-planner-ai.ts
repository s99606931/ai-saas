// Design Ref: §R296 — AI기반 클라우드 마이그레이션 계획
// Plan SC: SC-R296

export interface WorkloadProfile {
  workloadId: string
  name: string
  currentEnvironment: 'ON_PREMISE' | 'LEGACY' | 'HYBRID'
  cpuCores: number
  memoryGb: number
  storageGb: number
  monthlyTrafficGb: number
  dataGrade: 'O' | 'S' | 'C'
  dependencies: string[]
}

export interface MigrationPlan {
  workloadId: string
  recommendedStrategy: 'REHOST' | 'REPLATFORM' | 'REFACTOR' | 'RETAIN'
  targetEnvironment: 'K3S_ON_PREMISE' | 'HYBRID' | 'CANNOT_MIGRATE'
  estimatedEffortDays: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  blockers: string[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class CloudMigrationPlannerAi {
  private workloads = new Map<string, WorkloadProfile>()
  private auditLog: AuditEntry[] = []

  registerWorkload(workload: WorkloadProfile): void {
    // N2SF: C/S등급 데이터는 외부 클라우드 전송 불가 — 온프레미스 전용
    this.workloads.set(workload.workloadId, workload)
    this.auditLog.push({ action: 'workload.register', timestamp: new Date().toISOString(), detail: workload.workloadId })
  }

  plan(workloadId: string): MigrationPlan {
    const workload = this.workloads.get(workloadId)
    if (!workload) throw new Error(`Workload not found: ${workloadId}`)

    const blockers: string[] = []
    const recommendations: string[] = []

    // C/S 등급은 온프레미스만 가능
    if (workload.dataGrade === 'C' || workload.dataGrade === 'S') {
      blockers.push(`${workload.dataGrade}등급 데이터 — 온프레미스 전용 (N2SF N-03)`)
    }

    const hasDependencies = workload.dependencies.length > 0
    const isLargeWorkload = workload.cpuCores >= 8 || workload.memoryGb >= 32

    let strategy: MigrationPlan['recommendedStrategy']
    let targetEnvironment: MigrationPlan['targetEnvironment']
    let estimatedEffortDays: number

    if (workload.dataGrade === 'C' || workload.dataGrade === 'S') {
      targetEnvironment = 'K3S_ON_PREMISE'
      strategy = 'REHOST'
      estimatedEffortDays = 10
    } else if (workload.currentEnvironment === 'LEGACY') {
      strategy = 'REFACTOR'
      targetEnvironment = 'K3S_ON_PREMISE'
      estimatedEffortDays = 30
      recommendations.push('레거시 시스템 컨테이너화 필요')
    } else if (isLargeWorkload) {
      strategy = 'REPLATFORM'
      targetEnvironment = 'HYBRID'
      estimatedEffortDays = 20
    } else {
      strategy = 'REHOST'
      targetEnvironment = 'K3S_ON_PREMISE'
      estimatedEffortDays = 7
    }

    if (hasDependencies) {
      estimatedEffortDays += workload.dependencies.length * 3
      recommendations.push(`의존성 ${workload.dependencies.length}개 마이그레이션 순서 조율 필요`)
    }

    let riskLevel: MigrationPlan['riskLevel']
    if (blockers.length > 0 || strategy === 'REFACTOR') {
      riskLevel = 'HIGH'
    } else if (hasDependencies || strategy === 'REPLATFORM') {
      riskLevel = 'MEDIUM'
    } else {
      riskLevel = 'LOW'
    }

    this.auditLog.push({ action: 'migration.plan', timestamp: new Date().toISOString(), detail: workloadId })
    return { workloadId, recommendedStrategy: strategy, targetEnvironment, estimatedEffortDays, riskLevel, blockers, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
