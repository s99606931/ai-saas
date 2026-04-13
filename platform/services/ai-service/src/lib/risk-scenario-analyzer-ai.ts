// Design Ref: §R458 — AI기반 공공기관 리스크 시나리오 분석
// Plan SC: SVC-AI-ADV-R458-SC01

export type RiskCategory = 'SECURITY' | 'OPERATIONAL' | 'COMPLIANCE' | 'FINANCIAL' | 'REPUTATIONAL' | 'TECHNICAL'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ScenarioOutcome = 'ACCEPTABLE' | 'MANAGEABLE' | 'SERIOUS' | 'CATASTROPHIC'

export interface RiskFactor {
  factorId: string
  category: RiskCategory
  probability: number   // 0..1
  impact: number        // 0..1
  description: string
}

export interface RiskScenario {
  scenarioId: string
  name: string
  factors: RiskFactor[]
}

export interface ScenarioAnalysisResult {
  scenarioId: string
  name: string
  overallRiskScore: number   // 0..100
  riskLevel: RiskLevel
  outcome: ScenarioOutcome
  topFactors: Array<{ factorId: string; category: RiskCategory; riskScore: number }>
  mitigations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  scenarioId: string
  detail: Record<string, unknown>
}

export class RiskScenarioAnalyzerAI {
  private scenarios = new Map<string, RiskScenario>()
  private auditLog: AuditEntry[] = []

  registerScenario(scenario: RiskScenario): void {
    this.scenarios.set(scenario.scenarioId, scenario)
    this.appendAudit('scenario.register', scenario.scenarioId, { name: scenario.name, factorCount: scenario.factors.length })
  }

  analyze(scenarioId: string): ScenarioAnalysisResult {
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`)

    this.appendAudit('scenario.analyze', scenarioId, { factorCount: scenario.factors.length })

    const generatedAt = new Date().toISOString()

    if (scenario.factors.length === 0) {
      return {
        scenarioId, name: scenario.name, overallRiskScore: 0,
        riskLevel: 'LOW', outcome: 'ACCEPTABLE',
        topFactors: [], mitigations: [], generatedAt,
      }
    }

    // 각 요인의 리스크 점수 = probability * impact * 100
    const factorScores = scenario.factors.map((f) => ({
      factorId: f.factorId,
      category: f.category,
      riskScore: Math.round(f.probability * f.impact * 100),
    }))

    // 전체 리스크 점수: 최고 요인 60% + 평균 40%
    const maxScore = Math.max(...factorScores.map((f) => f.riskScore))
    const avgScore = factorScores.reduce((s, f) => s + f.riskScore, 0) / factorScores.length
    const overallRiskScore = Math.min(100, Math.round(maxScore * 0.6 + avgScore * 0.4))

    const topFactors = [...factorScores]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 3)

    const riskLevel: RiskLevel =
      overallRiskScore >= 70 ? 'CRITICAL'
        : overallRiskScore >= 50 ? 'HIGH'
        : overallRiskScore >= 30 ? 'MEDIUM'
        : 'LOW'

    const outcome: ScenarioOutcome =
      riskLevel === 'CRITICAL' ? 'CATASTROPHIC'
        : riskLevel === 'HIGH' ? 'SERIOUS'
        : riskLevel === 'MEDIUM' ? 'MANAGEABLE'
        : 'ACCEPTABLE'

    // 카테고리별 완화 전략
    const mitigations: string[] = []
    const topCategories = new Set(topFactors.map((f) => f.category))
    if (topCategories.has('SECURITY')) mitigations.push('보안 감사 및 침투 테스트 수행')
    if (topCategories.has('COMPLIANCE')) mitigations.push('CSAP/N2SF 준수 사항 즉시 검토')
    if (topCategories.has('OPERATIONAL')) mitigations.push('비즈니스 연속성 계획(BCP) 수립')
    if (topCategories.has('FINANCIAL')) mitigations.push('재무 리스크 헤지 및 예비 예산 확보')
    if (topCategories.has('TECHNICAL')) mitigations.push('기술 부채 감소 및 아키텍처 검토')
    if (topCategories.has('REPUTATIONAL')) mitigations.push('대외 커뮤니케이션 전략 준비')
    if (mitigations.length === 0) mitigations.push('현재 리스크 수준 허용 — 정기 모니터링 유지')

    return { scenarioId, name: scenario.name, overallRiskScore, riskLevel, outcome, topFactors, mitigations, generatedAt }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, scenarioId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, scenarioId, detail })
  }
}
