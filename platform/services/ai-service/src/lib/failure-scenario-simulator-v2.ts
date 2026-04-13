// Plan SC: SVC-AI-ADV-R439
// Design Ref: §IMPACT_SCORE — severity별 영향도 점수 매핑

type Severity = 'critical' | 'high' | 'medium' | 'low'
type DataGrade = 'O' | 'C' | 'S'

interface FailureScenario {
  scenarioId: string
  name: string
  severity: Severity
  impactScore: number
  active: boolean
}

interface SimulationResult {
  scenarioId: string
  impactScore: number
  runAt: string
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const IMPACT_SCORE: Record<Severity, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 10,
}

export class FailureScenarioSimulatorV2 {
  private scenarios = new Map<string, FailureScenario>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerScenario(scenarioId: string, name: string, severity: Severity): FailureScenario {
    const scenario: FailureScenario = {
      scenarioId,
      name,
      severity,
      impactScore: IMPACT_SCORE[severity],
      active: true,
    }
    this.scenarios.set(scenarioId, scenario)
    this.log('scenario.register', `scenarioId=${scenarioId} severity=${severity}`)
    return scenario
  }

  runSimulation(scenarioId: string, dataGrade?: DataGrade): SimulationResult {
    this.checkGrade(dataGrade)
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) throw new Error('scenarioId 없음')
    const result: SimulationResult = {
      scenarioId,
      impactScore: scenario.impactScore,
      runAt: new Date().toISOString(),
    }
    this.log('scenario.run', `scenarioId=${scenarioId} impactScore=${scenario.impactScore}`)
    return result
  }

  getActiveScenarios(): FailureScenario[] {
    return Array.from(this.scenarios.values()).filter((s) => s.active)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
