// Design Ref: §R564 — AI기반 서비스 회복력 자동 시험 v2
// Plan SC: SVC-AI-ADV-R564-SC01

export type ScenarioType = 'SERVICE_DOWN' | 'NETWORK_LATENCY' | 'DEPENDENCY_FAILURE' | 'CPU_SPIKE' | 'MEMORY_PRESSURE'
export type TestResult = 'PASS' | 'FAIL' | 'PARTIAL'

export interface ResilienceScenario {
  scenarioId: string
  name: string
  scenarioType: ScenarioType
  targetServiceId: string
  durationMs: number
  expectedRecoveryTimeMs: number
  description: string
}

export interface ScenarioTestResult {
  scenarioId: string
  scenarioName: string
  scenarioType: ScenarioType
  targetServiceId: string
  result: TestResult
  actualRecoveryTimeMs: number
  expectedRecoveryTimeMs: number
  passed: boolean
  issues: string[]
  recommendations: string[]
  testedAt: string
}

export interface ResilienceReport {
  totalScenarios: number
  passCount: number
  failCount: number
  partialCount: number
  resilienceScore: number   // 0..100 (PASS 비율)
  criticalFailures: string[]  // PASS 못한 CRITICAL 시나리오명
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  scenarioId: string
  detail: Record<string, unknown>
}

// 시나리오 유형별 기준 복구 시간 (ms)
const RECOVERY_TIME_BY_TYPE: Record<ScenarioType, number> = {
  SERVICE_DOWN: 10_000,
  NETWORK_LATENCY: 5_000,
  DEPENDENCY_FAILURE: 15_000,
  CPU_SPIKE: 8_000,
  MEMORY_PRESSURE: 12_000,
}

export class ServiceResilienceTesterV2 {
  private scenarios = new Map<string, ResilienceScenario>()
  private testResults: ScenarioTestResult[] = []
  private auditLog: AuditEntry[] = []

  registerScenario(scenario: ResilienceScenario): void {
    this.scenarios.set(scenario.scenarioId, scenario)
    this.appendAudit('scenario.register', scenario.scenarioId, { name: scenario.name, type: scenario.scenarioType })
  }

  runTest(scenarioId: string): ScenarioTestResult {
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`)

    // 시뮬레이션: 기준 복구 시간 기반 실제 복구 시간 생성
    const baseTime = RECOVERY_TIME_BY_TYPE[scenario.scenarioType]
    // 예상 복구 시간이 기준보다 짧게 설정된 경우 실패 시뮬레이션
    const actualRecoveryTimeMs = scenario.expectedRecoveryTimeMs < baseTime
      ? Math.round(baseTime * 1.2)  // 기준 대비 20% 초과
      : Math.round(baseTime * 0.8)  // 기준 대비 20% 단축 (정상)

    const passed = actualRecoveryTimeMs < 30_000
    const result: TestResult = passed ? 'PASS' : 'FAIL'

    const issues: string[] = []
    const recommendations: string[] = []

    if (!passed) {
      issues.push(`복구 시간 ${actualRecoveryTimeMs}ms — 임계값(30초) 초과`)
      recommendations.push(`'${scenario.scenarioType}' 시나리오 회복 절차 개선 필요`)
    }
    if (actualRecoveryTimeMs > scenario.expectedRecoveryTimeMs) {
      issues.push(`실제 복구 시간(${actualRecoveryTimeMs}ms)이 목표(${scenario.expectedRecoveryTimeMs}ms) 초과`)
      recommendations.push('자동 복구 메커니즘 강화 또는 대기 인스턴스 추가 검토')
    }

    const testResult: ScenarioTestResult = {
      scenarioId,
      scenarioName: scenario.name,
      scenarioType: scenario.scenarioType,
      targetServiceId: scenario.targetServiceId,
      result,
      actualRecoveryTimeMs,
      expectedRecoveryTimeMs: scenario.expectedRecoveryTimeMs,
      passed,
      issues,
      recommendations,
      testedAt: new Date().toISOString(),
    }

    this.testResults.push(testResult)
    this.appendAudit('scenario.run', scenarioId, { result, actualRecoveryTimeMs, passed })
    return testResult
  }

  calculateResilienceScore(): number {
    if (this.testResults.length === 0) return 0
    const passCount = this.testResults.filter((r) => r.passed).length
    return Math.round((passCount / this.testResults.length) * 100)
  }

  generateReport(): ResilienceReport {
    const results = [...this.testResults]
    const passCount = results.filter((r) => r.result === 'PASS').length
    const failCount = results.filter((r) => r.result === 'FAIL').length
    const partialCount = results.filter((r) => r.result === 'PARTIAL').length
    const resilienceScore = this.calculateResilienceScore()
    const criticalFailures = results
      .filter((r) => !r.passed)
      .map((r) => r.scenarioName)

    const recommendations: string[] = []
    if (resilienceScore < 80) recommendations.push(`회복력 점수 ${resilienceScore}점 — 목표(80점) 미달, 장애 대응 훈련 실시 권고`)
    if (failCount > 0) recommendations.push(`${failCount}개 시나리오 실패 — 회복 절차 재검토 및 재시험 필요`)

    this.appendAudit('report.generate', 'system', { totalScenarios: results.length, resilienceScore })
    return {
      totalScenarios: results.length,
      passCount,
      failCount,
      partialCount,
      resilienceScore,
      criticalFailures,
      recommendations,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, scenarioId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, scenarioId, detail })
  }
}
