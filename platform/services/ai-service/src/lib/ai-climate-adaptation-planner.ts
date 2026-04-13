// Design Ref: §R507 — AI 기후 적응 계획 수립
// Plan SC: SVC-AI-ADV-R507-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type ClimateRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE'
export type AdaptationCategory = 'INFRASTRUCTURE' | 'HEALTH' | 'AGRICULTURE' | 'ECOSYSTEM'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface ClimateIndicator {
  region: string
  avgTempIncreaseC: number
  precipitationChangePct: number
  extremeEventsPerYear: number
  seaLevelRiseCm: number
}

export interface AdaptationAction {
  actionId: string
  category: AdaptationCategory
  description: string
  estimatedCostKRW: number
  priority: number
}

export interface AdaptationPlan {
  region: string
  riskLevel: ClimateRiskLevel
  riskScore: number
  actions: AdaptationAction[]
  totalCostKRW: number
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class AiClimateAdaptationPlanner {
  private readonly auditLog: AuditEntry[] = []

  generatePlan(indicator: ClimateIndicator, grade: DataGrade): AdaptationPlan {
    blockClassifiedData(grade)
    if (!indicator.region) throw new Error('region 필수')
    if (indicator.avgTempIncreaseC < 0) throw new Error('temp 증가는 0 이상')
    if (indicator.extremeEventsPerYear < 0) throw new Error('extremeEvents는 0 이상')

    const riskScore = this.computeRiskScore(indicator)
    const riskLevel = this.scoreToLevel(riskScore)
    const actions: AdaptationAction[] = []

    if (indicator.avgTempIncreaseC >= 1.5) {
      actions.push({
        actionId: 'HEAT_001',
        category: 'HEALTH',
        description: '폭염 대피소 확충 및 취약계층 모니터링',
        estimatedCostKRW: 500_000_000,
        priority: 1,
      })
    }
    if (indicator.precipitationChangePct >= 20 || indicator.precipitationChangePct <= -20) {
      actions.push({
        actionId: 'WATER_001',
        category: 'INFRASTRUCTURE',
        description: '강수 변동 대응 — 우수저류시설/저수지 정비',
        estimatedCostKRW: 2_000_000_000,
        priority: 2,
      })
    }
    if (indicator.extremeEventsPerYear >= 3) {
      actions.push({
        actionId: 'INFRA_001',
        category: 'INFRASTRUCTURE',
        description: '재난 인프라 강화 — 배수/제방',
        estimatedCostKRW: 3_500_000_000,
        priority: 1,
      })
    }
    if (indicator.seaLevelRiseCm >= 5) {
      actions.push({
        actionId: 'COAST_001',
        category: 'ECOSYSTEM',
        description: '해안 침식 방지 및 생태 복원',
        estimatedCostKRW: 1_500_000_000,
        priority: 2,
      })
    }
    if (actions.length === 0) {
      actions.push({
        actionId: 'BASE_001',
        category: 'AGRICULTURE',
        description: '기후 변화 모니터링 강화',
        estimatedCostKRW: 100_000_000,
        priority: 3,
      })
    }

    const totalCostKRW = actions.reduce((s, a) => s + a.estimatedCostKRW, 0)
    actions.sort((a, b) => a.priority - b.priority)

    this.appendAudit('plan.generate', { region: indicator.region, riskLevel, totalCostKRW })

    return { region: indicator.region, riskLevel, riskScore, actions, totalCostKRW }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private computeRiskScore(i: ClimateIndicator): number {
    return Math.round(
      i.avgTempIncreaseC * 20 +
        Math.abs(i.precipitationChangePct) * 0.8 +
        i.extremeEventsPerYear * 8 +
        i.seaLevelRiseCm * 3
    )
  }

  private scoreToLevel(score: number): ClimateRiskLevel {
    if (score >= 100) return 'SEVERE'
    if (score >= 60) return 'HIGH'
    if (score >= 30) return 'MODERATE'
    return 'LOW'
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
