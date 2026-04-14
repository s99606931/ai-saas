// Design Ref: §R616 — AI기반 공공기관 업무 연속성 계획 v2
// Plan SC: SVC-AI-ADV-R616-SC01

export type ScenarioType = 'CYBER_ATTACK' | 'NATURAL_DISASTER' | 'POWER_OUTAGE' | 'DATA_LOSS' | 'SYSTEM_FAILURE'
export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type RecoveryPriority = 'P1' | 'P2' | 'P3'

export interface RiskScenario {
  scenarioId: string
  name: string
  type: ScenarioType
  impactLevel: ImpactLevel
  probabilityPct: number  // 0..100
  affectedSystems: string[]
}

export interface RiskAnalysis {
  scenarioId: string
  name: string
  riskScore: number  // impactWeight × probability
  rtoMinutes: number  // Recovery Time Objective
  rpoMinutes: number  // Recovery Point Objective
  riskLevel: ImpactLevel
}

export interface RecoveryAction {
  actionId: string
  description: string
  priority: RecoveryPriority
  assignee: string
  estimatedMinutes: number
}

export interface ContinuityPlan {
  scenarioId: string
  name: string
  rtoMinutes: number
  rpoMinutes: number
  actions: RecoveryAction[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  scenarioId: string
  detail: Record<string, unknown>
}

const IMPACT_WEIGHTS: Record<ImpactLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

const RTO_BY_TYPE: Record<ScenarioType, number> = {
  CYBER_ATTACK: 240,
  NATURAL_DISASTER: 480,
  POWER_OUTAGE: 60,
  DATA_LOSS: 120,
  SYSTEM_FAILURE: 30,
}

const RPO_BY_TYPE: Record<ScenarioType, number> = {
  CYBER_ATTACK: 60,
  NATURAL_DISASTER: 240,
  POWER_OUTAGE: 15,
  DATA_LOSS: 30,
  SYSTEM_FAILURE: 10,
}

export class BusinessContinuityPlannerV2 {
  private scenarios = new Map<string, RiskScenario>()
  private auditLog: AuditEntry[] = []

  registerScenario(scenario: RiskScenario): void {
    this.scenarios.set(scenario.scenarioId, scenario)
    this.appendAudit('scenario.register', scenario.scenarioId, { name: scenario.name, type: scenario.type })
  }

  analyzeRisk(scenarioId: string): RiskAnalysis {
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`)

    const impactWeight = IMPACT_WEIGHTS[scenario.impactLevel]
    const riskScore = Math.round((impactWeight * scenario.probabilityPct) / 100 * 25)
    const rtoMinutes = RTO_BY_TYPE[scenario.type]
    const rpoMinutes = RPO_BY_TYPE[scenario.type]

    const riskLevel: ImpactLevel = riskScore >= 75 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW'

    this.appendAudit('risk.analyze', scenarioId, { riskScore, rtoMinutes, rpoMinutes })
    return { scenarioId, name: scenario.name, riskScore, rtoMinutes, rpoMinutes, riskLevel }
  }

  generatePlan(scenarioId: string): ContinuityPlan {
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`)

    const analysis = this.analyzeRisk(scenarioId)
    const actions: RecoveryAction[] = []
    let actionCounter = 1

    actions.push({
      actionId: `ACT-${scenarioId}-${actionCounter++}`,
      description: '비상 대응팀 소집 및 상황 파악',
      priority: 'P1',
      assignee: '비상대응팀장',
      estimatedMinutes: 15,
    })

    if (scenario.type === 'CYBER_ATTACK') {
      actions.push({
        actionId: `ACT-${scenarioId}-${actionCounter++}`,
        description: '침해 시스템 네트워크 격리',
        priority: 'P1',
        assignee: '보안 담당자',
        estimatedMinutes: 30,
      })
      actions.push({
        actionId: `ACT-${scenarioId}-${actionCounter++}`,
        description: '침해 경로 분석 및 악성코드 제거',
        priority: 'P2',
        assignee: '보안 담당자',
        estimatedMinutes: 60,
      })
    }

    if (scenario.type === 'DATA_LOSS' || scenario.type === 'SYSTEM_FAILURE') {
      actions.push({
        actionId: `ACT-${scenarioId}-${actionCounter++}`,
        description: '최신 백업에서 데이터 복구',
        priority: 'P1',
        assignee: 'DB 관리자',
        estimatedMinutes: analysis.rpoMinutes,
      })
    }

    for (const system of scenario.affectedSystems) {
      actions.push({
        actionId: `ACT-${scenarioId}-${actionCounter++}`,
        description: `${system} 서비스 복구 및 정상 동작 확인`,
        priority: 'P2',
        assignee: '시스템 운영팀',
        estimatedMinutes: 20,
      })
    }

    actions.push({
      actionId: `ACT-${scenarioId}-${actionCounter++}`,
      description: '서비스 복구 완료 보고 및 사후 분석',
      priority: 'P3',
      assignee: 'IT 운영팀장',
      estimatedMinutes: 30,
    })

    this.appendAudit('plan.generate', scenarioId, { actionCount: actions.length, rtoMinutes: analysis.rtoMinutes })
    return {
      scenarioId,
      name: scenario.name,
      rtoMinutes: analysis.rtoMinutes,
      rpoMinutes: analysis.rpoMinutes,
      actions,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, scenarioId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, scenarioId, detail })
  }
}
