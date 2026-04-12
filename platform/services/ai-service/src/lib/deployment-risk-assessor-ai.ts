// Design Ref: §R211 — AI기반 배포 리스크 자동 평가
// Plan SC: SVC-AI-ADV-R211-SC01

export interface DeploymentPlan {
  deployId: string
  serviceName: string
  version: string
  targetEnvironment: 'DEV' | 'STAGING' | 'PRODUCTION'
  changedFiles: number
  hasDatabaseMigration: boolean
  hasConfigChange: boolean
  rollbackPlanReady: boolean
  deployedAt?: string
}

export type DeployRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface DeployRiskReport {
  deployId: string
  riskLevel: DeployRiskLevel
  riskScore: number
  riskFactors: string[]
  approvalRequired: boolean
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  deployId: string
  detail: Record<string, unknown>
}

export class DeploymentRiskAssessorAI {
  private auditLog: AuditEntry[] = []

  assess(plan: DeploymentPlan): DeployRiskReport {
    const riskFactors: string[] = []
    let riskScore = 0

    // 프로덕션 환경
    if (plan.targetEnvironment === 'PRODUCTION') {
      riskScore += 20
      riskFactors.push('프로덕션 환경 배포')
    }

    // DB 마이그레이션
    if (plan.hasDatabaseMigration) {
      riskScore += 30
      riskFactors.push('데이터베이스 마이그레이션 포함')
    }

    // 설정 변경
    if (plan.hasConfigChange) {
      riskScore += 15
      riskFactors.push('설정 파일 변경 포함')
    }

    // 롤백 계획 미비
    if (!plan.rollbackPlanReady) {
      riskScore += 20
      riskFactors.push('롤백 계획 미비')
    }

    // 변경 파일 수
    if (plan.changedFiles >= 50) {
      riskScore += 20
      riskFactors.push(`대규모 변경 (${plan.changedFiles}개 파일)`)
    } else if (plan.changedFiles >= 20) {
      riskScore += 10
      riskFactors.push(`중규모 변경 (${plan.changedFiles}개 파일)`)
    }

    const riskLevel: DeployRiskLevel =
      riskScore >= 70 ? 'CRITICAL' : riskScore >= 45 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW'

    const approvalRequired = riskLevel === 'CRITICAL' || riskLevel === 'HIGH'

    const recommendation =
      riskLevel === 'CRITICAL' ? '배포 중단 권고 — CTO 승인 및 롤백 계획 완비 필수'
        : riskLevel === 'HIGH' ? '배포 전 팀장 승인 필수, 점진적 배포(Canary) 권장'
        : riskLevel === 'MEDIUM' ? '피크 시간 외 배포 권장, 모니터링 강화'
        : '정상 배포 가능'

    this.appendAudit('deploy.assess', plan.deployId, { riskLevel, riskScore })

    return {
      deployId: plan.deployId,
      riskLevel,
      riskScore,
      riskFactors,
      approvalRequired,
      recommendation,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, deployId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, deployId, detail })
  }
}
