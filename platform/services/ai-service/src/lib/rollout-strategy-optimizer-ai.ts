// Design Ref: §R336 — AI기반 서비스 롤아웃 전략 최적화
// Plan SC: SC-R336

export interface RolloutContext {
  serviceId: string
  serviceName: string
  changeType: 'PATCH' | 'MINOR' | 'MAJOR' | 'HOTFIX'
  hasDbMigration: boolean
  estimatedImpactedUsers: number
  currentErrorRate: number
  recentIncidentCount: number
}

export type RolloutStrategy = 'CANARY' | 'BLUE_GREEN' | 'ROLLING' | 'IMMEDIATE' | 'FEATURE_FLAG'

export interface RolloutPlan {
  serviceId: string
  recommendedStrategy: RolloutStrategy
  initialTrafficPercent: number
  rolloutSteps: { step: number; trafficPercent: number; waitMinutes: number; condition: string }[]
  rollbackTrigger: string
  estimatedDurationMinutes: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class RolloutStrategyOptimizerAi {
  private auditLog: AuditEntry[] = []

  optimize(context: RolloutContext): RolloutPlan {
    let strategy: RolloutStrategy
    let initialTrafficPercent: number
    let riskLevel: RolloutPlan['riskLevel']
    let rolloutSteps: RolloutPlan['rolloutSteps']

    // 위험 점수 계산
    let riskScore = 0
    if (context.changeType === 'MAJOR') riskScore += 30
    else if (context.changeType === 'MINOR') riskScore += 15
    else if (context.changeType === 'HOTFIX') riskScore -= 10
    if (context.hasDbMigration) riskScore += 25
    if (context.estimatedImpactedUsers > 10000) riskScore += 20
    if (context.currentErrorRate > 0.05) riskScore += 15
    if (context.recentIncidentCount >= 2) riskScore += 15

    if (riskScore >= 50) riskLevel = 'HIGH'
    else if (riskScore >= 25) riskLevel = 'MEDIUM'
    else riskLevel = 'LOW'

    // 전략 결정
    if (context.changeType === 'HOTFIX') {
      strategy = 'IMMEDIATE'
      initialTrafficPercent = 100
      rolloutSteps = [{ step: 1, trafficPercent: 100, waitMinutes: 0, condition: '즉시 전체 배포' }]
    } else if (riskLevel === 'HIGH' || context.hasDbMigration) {
      strategy = 'BLUE_GREEN'
      initialTrafficPercent = 0
      rolloutSteps = [
        { step: 1, trafficPercent: 5, waitMinutes: 30, condition: '에러율 < 0.1%' },
        { step: 2, trafficPercent: 25, waitMinutes: 60, condition: '에러율 < 0.1%' },
        { step: 3, trafficPercent: 100, waitMinutes: 0, condition: '수동 승인 후 전환' },
      ]
    } else if (riskLevel === 'MEDIUM') {
      strategy = 'CANARY'
      initialTrafficPercent = 5
      rolloutSteps = [
        { step: 1, trafficPercent: 5, waitMinutes: 30, condition: '에러율 < 0.5%' },
        { step: 2, trafficPercent: 25, waitMinutes: 30, condition: '에러율 < 0.5%' },
        { step: 3, trafficPercent: 100, waitMinutes: 0, condition: '안정 확인 후 전체' },
      ]
    } else {
      strategy = 'ROLLING'
      initialTrafficPercent = 20
      rolloutSteps = [
        { step: 1, trafficPercent: 20, waitMinutes: 10, condition: '헬스체크 통과' },
        { step: 2, trafficPercent: 60, waitMinutes: 10, condition: '헬스체크 통과' },
        { step: 3, trafficPercent: 100, waitMinutes: 0, condition: '완료' },
      ]
    }

    const estimatedDurationMinutes = rolloutSteps.reduce((s, step) => s + step.waitMinutes, 0)
    const rollbackTrigger = riskLevel === 'HIGH' ? '에러율 0.1% 초과 또는 응답시간 2배 초과 시 즉시 롤백' : '에러율 1% 초과 시 롤백'

    this.auditLog.push({ action: 'rollout.optimize', timestamp: new Date().toISOString(), detail: `${context.serviceId}:${strategy}` })
    return { serviceId: context.serviceId, recommendedStrategy: strategy, initialTrafficPercent, rolloutSteps, rollbackTrigger, estimatedDurationMinutes, riskLevel }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
