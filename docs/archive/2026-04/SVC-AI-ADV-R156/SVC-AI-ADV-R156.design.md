# SVC-AI-ADV-R156 — SLA 자동 협상 엔진 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface SLARequirement {
  availabilityPercent: number   // 예: 99.9
  responseTimeMs: number        // 예: 200
  rtoMinutes: number            // Recovery Time Objective
  rpoMinutes: number            // Recovery Point Objective
}

export interface InfraCapability {
  maxAvailability: number       // 인프라 최대 가용성
  minResponseTimeMs: number
  minRtoMinutes: number
  minRpoMinutes: number
}

export interface SLAProposal {
  tier: 'conservative' | 'standard' | 'aggressive'
  availabilityPercent: number
  responseTimeMs: number
  rtoMinutes: number
  rpoMinutes: number
  feasible: boolean
  score: number                 // 0~1 (요구사항 충족도)
}

export interface NegotiationResult {
  clientRequirement: SLARequirement
  proposals: SLAProposal[]
  recommended: SLAProposal
  midpoint: SLARequirement
}

class SLAAutoNegotiator {
  constructor(grade: DataGrade, capability: InfraCapability)
  analyze(requirement: SLARequirement): NegotiationResult
  simulate(client: SLARequirement, provider: SLARequirement): SLARequirement
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- conservative: 요구사항의 90% 수준 제안
- standard: 요구사항과 인프라 최대값의 중간
- aggressive: 인프라 최대 능력 그대로
- score = (충족 항목 수 / 4)
- midpoint = (client + provider) / 2 클램핑
