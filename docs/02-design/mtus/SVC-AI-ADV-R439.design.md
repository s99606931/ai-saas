# SVC-AI-ADV-R439 Design — failure-scenario-simulator-v2.ts

Plan Ref: SVC-AI-ADV-R439.plan.md

## 클래스 설계

```typescript
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

class FailureScenarioSimulatorV2 {
  registerScenario(scenarioId, name, severity): FailureScenario
  runSimulation(scenarioId, dataGrade?): SimulationResult
  getActiveScenarios(): FailureScenario[]
  getAuditLog(): AuditEntry[]
}
```

## IMPACT_SCORE 매핑
| severity | score |
|----------|-------|
| critical | 100 |
| high | 70 |
| medium | 40 |
| low | 10 |

## N2SF N-05
C/S 등급 시 `throw new Error('BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)')`
