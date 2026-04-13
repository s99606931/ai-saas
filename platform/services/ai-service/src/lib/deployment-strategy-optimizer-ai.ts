// Design Ref: §R372 — AI기반 자동 배포 전략 최적화
// Plan SC: SVC-AI-ADV-R372-SC01

export type DeploymentStrategy = 'ROLLING' | 'BLUE_GREEN' | 'CANARY' | 'RECREATE'
export type Environment = 'DEV' | 'STAGING' | 'PRODUCTION'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface DeploymentCandidate {
  deploymentId: string
  serviceName: string
  environment: Environment
  changeType: 'FEATURE' | 'BUGFIX' | 'HOTFIX' | 'SCHEMA_MIGRATION' | 'CONFIG'
  changeSize: number  // 변경 파일 수
  hasRollbackPlan: boolean
  estimatedDowntimeMs: number
  previousFailureRate: number  // 0..1 이전 배포 실패율
}

export interface DeploymentPlan {
  deploymentId: string
  recommendedStrategy: DeploymentStrategy
  riskLevel: RiskLevel
  approvalRequired: boolean
  estimatedDurationMin: number
  rollbackTimeMin: number
  warnings: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  deploymentId: string
  detail: Record<string, unknown>
}

export class DeploymentStrategyOptimizerAI {
  private auditLog: AuditEntry[] = []

  optimize(candidate: DeploymentCandidate): DeploymentPlan {
    const warnings: string[] = []
    let riskScore = 0

    // 리스크 요인 계산
    if (candidate.changeType === 'SCHEMA_MIGRATION') riskScore += 30
    if (!candidate.hasRollbackPlan) { riskScore += 20; warnings.push('롤백 계획 없음 — 배포 전 롤백 시나리오 수립 필요') }
    if (candidate.environment === 'PRODUCTION') riskScore += 20
    if (candidate.changeSize >= 50) { riskScore += 20; warnings.push(`대규모 변경 (${candidate.changeSize}개 파일) — 스테이징 검증 필수`) }
    if (candidate.previousFailureRate >= 0.3) { riskScore += 20; warnings.push(`이전 배포 실패율 ${(candidate.previousFailureRate * 100).toFixed(0)}% 높음`) }
    if (candidate.estimatedDowntimeMs > 0) { riskScore += 10; warnings.push(`예상 다운타임 ${candidate.estimatedDowntimeMs}ms 존재`) }

    const riskLevel: RiskLevel =
      riskScore >= 70 ? 'CRITICAL'
        : riskScore >= 40 ? 'HIGH'
        : riskScore >= 20 ? 'MEDIUM'
        : 'LOW'

    // 배포 전략 결정
    let recommendedStrategy: DeploymentStrategy
    if (candidate.changeType === 'HOTFIX' && candidate.environment === 'PRODUCTION') {
      recommendedStrategy = 'BLUE_GREEN'
    } else if (candidate.changeType === 'SCHEMA_MIGRATION') {
      recommendedStrategy = 'RECREATE'
    } else if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      recommendedStrategy = 'CANARY'
    } else if (candidate.environment === 'PRODUCTION') {
      recommendedStrategy = 'ROLLING'
    } else {
      recommendedStrategy = 'ROLLING'
    }

    const approvalRequired = riskLevel === 'CRITICAL' || riskLevel === 'HIGH'

    // 예상 배포/롤백 시간 (분)
    const durationMap: Record<DeploymentStrategy, number> = {
      ROLLING: 10, BLUE_GREEN: 5, CANARY: 30, RECREATE: 15,
    }
    const rollbackMap: Record<DeploymentStrategy, number> = {
      ROLLING: 10, BLUE_GREEN: 2, CANARY: 5, RECREATE: 15,
    }

    this.appendAudit('deployment.optimize', candidate.deploymentId, {
      strategy: recommendedStrategy, riskLevel, approvalRequired,
    })

    return {
      deploymentId: candidate.deploymentId,
      recommendedStrategy,
      riskLevel,
      approvalRequired,
      estimatedDurationMin: durationMap[recommendedStrategy],
      rollbackTimeMin: rollbackMap[recommendedStrategy],
      warnings,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, deploymentId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, deploymentId, detail })
  }
}
