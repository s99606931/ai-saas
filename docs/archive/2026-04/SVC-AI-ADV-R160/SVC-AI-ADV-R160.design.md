# SVC-AI-ADV-R160 — 재해 복구 자동화 AI (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface ServiceNode {
  id: string
  rtoMinutes: number
  rpoMinutes: number
  dependencies: string[]
  priority: number         // 1-10 (높을수록 먼저 복구)
  recoveryTimeMinutes: number
}

export interface DisasterScenario {
  id: string
  affectedServices: string[]
  severity: 'partial' | 'full'
}

export interface RecoveryStep {
  order: number
  serviceId: string
  estimatedMinutes: number
  cumulativeMinutes: number
  rtoMet: boolean
}

export interface RecoveryPlan {
  scenarioId: string
  steps: RecoveryStep[]
  totalMinutes: number
  allRtoMet: boolean
  allRpoMet: boolean
  warnings: string[]
}

class DisasterRecoveryAI {
  constructor(grade: DataGrade)
  registerService(service: ServiceNode): void
  generatePlan(scenario: DisasterScenario): RecoveryPlan
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- 복구 순서: 의존성 없는 서비스 먼저 (Kahn 토폴로지 정렬), 동 레벨은 priority 내림차순
- RTO 검증: cumulativeMinutes <= service.rtoMinutes
- RPO 검증: scenario.severity === 'partial' → rpo 기본 충족, 'full' → rpo 경고
- warnings: RTO 초과 서비스 목록
