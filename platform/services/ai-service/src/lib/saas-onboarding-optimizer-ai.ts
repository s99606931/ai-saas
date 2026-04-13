// Design Ref: §R270 — AI기반 SaaS 온보딩 최적화
// Plan SC: SVC-AI-ADV-R270-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type OnboardingStage = 'SIGNUP' | 'PROFILE_SETUP' | 'INTEGRATION' | 'TRAINING' | 'GO_LIVE'
export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'STUCK' | 'DROPPED'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface TenantOnboarding {
  tenantId: string
  orgName: string
  targetGoLiveDate: string  // ISO date
  assignedSupportLevel: 'BASIC' | 'STANDARD' | 'PREMIUM'
}

export interface StageProgress {
  tenantId: string
  stage: OnboardingStage
  status: OnboardingStatus
  completedAt?: string
  daysSpent: number
}

export interface OnboardingAnalysis {
  tenantId: string
  currentStage: OnboardingStage
  overallProgress: number  // 0~100
  riskLevel: RiskLevel
  blockedStages: OnboardingStage[]
  recommendations: string[]
  estimatedCompletionDays: number
}

interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  detail: Record<string, unknown>
}

const STAGE_ORDER: OnboardingStage[] = ['SIGNUP', 'PROFILE_SETUP', 'INTEGRATION', 'TRAINING', 'GO_LIVE']
const EXPECTED_DAYS: Record<OnboardingStage, number> = {
  SIGNUP: 1, PROFILE_SETUP: 3, INTEGRATION: 10, TRAINING: 5, GO_LIVE: 2,
}

export class SaasOnboardingOptimizerAi {
  private tenants = new Map<string, TenantOnboarding>()
  private progress = new Map<string, StageProgress[]>()
  private auditLog: AuditEntry[] = []

  registerTenant(tenant: TenantOnboarding): void {
    this.tenants.set(tenant.tenantId, tenant)
    this.progress.set(tenant.tenantId, [])
    this.appendAudit('tenant.register', tenant.tenantId, { orgName: tenant.orgName, supportLevel: tenant.assignedSupportLevel })
  }

  recordProgress(progress: StageProgress): void {
    if (!this.tenants.has(progress.tenantId)) throw new Error(`Unknown tenant: ${progress.tenantId}`)
    const list = this.progress.get(progress.tenantId) ?? []
    // 같은 단계 업데이트
    const existingIdx = list.findIndex((p) => p.stage === progress.stage)
    if (existingIdx >= 0) {
      list[existingIdx] = progress
    } else {
      list.push(progress)
    }
    this.progress.set(progress.tenantId, list)
  }

  analyze(tenantId: string): OnboardingAnalysis {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) throw new Error(`Unknown tenant: ${tenantId}`)

    const stageList = this.progress.get(tenantId) ?? []
    const recommendations: string[] = []
    const blockedStages: OnboardingStage[] = []

    const completedStages = stageList.filter((p) => p.status === 'COMPLETED').map((p) => p.stage)
    const stuckStages = stageList.filter((p) => p.status === 'STUCK').map((p) => p.stage)

    blockedStages.push(...stuckStages)

    // 현재 단계: 완료 단계 다음 단계
    const lastCompletedIdx = completedStages.length > 0
      ? Math.max(...completedStages.map((s) => STAGE_ORDER.indexOf(s)))
      : -1
    const currentStage = STAGE_ORDER[lastCompletedIdx + 1] ?? STAGE_ORDER[STAGE_ORDER.length - 1]!

    const overallProgress = Math.round((completedStages.length / STAGE_ORDER.length) * 100)

    // 지연 탐지
    for (const p of stageList) {
      if (p.status === 'IN_PROGRESS' || p.status === 'STUCK') {
        const expectedDays = EXPECTED_DAYS[p.stage]
        if (p.daysSpent > expectedDays * 2) {
          recommendations.push(`${p.stage} 단계 ${p.daysSpent}일 경과 — 예상 ${expectedDays}일 대비 2배 초과`)
        }
      }
    }

    if (stuckStages.length > 0) {
      recommendations.push(`차단된 단계: ${stuckStages.join(', ')} — 지원팀 개입 필요`)
    }

    if (tenant.assignedSupportLevel === 'BASIC' && stuckStages.length > 0) {
      recommendations.push('STANDARD 이상 지원 레벨 업그레이드 권고')
    }

    const remainingStages = STAGE_ORDER.slice(lastCompletedIdx + 1)
    const estimatedDays = remainingStages.reduce((s, stage) => s + EXPECTED_DAYS[stage], 0)

    const riskLevel: RiskLevel =
      stuckStages.length > 1 ? 'HIGH' :
      stuckStages.length > 0 || overallProgress < 30 ? 'MEDIUM' : 'LOW'

    this.appendAudit('onboarding.analyze', tenantId, { currentStage, overallProgress, riskLevel })

    return { tenantId, currentStage, overallProgress, riskLevel, blockedStages, recommendations, estimatedCompletionDays: estimatedDays }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, tenantId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, tenantId, detail })
  }
}
