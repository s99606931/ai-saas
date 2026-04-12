# MTU Design — SVC-AI-ADV-R141 Citizen Journey Orchestrator

## 타입

```typescript
interface JourneyStage { id: string; slaMinutes: number; nextOnSuccess?: string; nextOnFailure?: string }
interface JourneyInstance { citizenHash: string; currentStageId: string; enteredAt: number; history: StageVisit[]; status: 'active'|'completed'|'delayed' }
interface StageVisit { stageId: string; enteredAt: number; leftAt?: number; outcome?: 'success'|'failure' }
```

## 메서드

- `defineStage(stage)` — 단계 정의
- `startJourney(citizenHash, initialStageId, grade)` — 인스턴스 생성
- `advance(instance, outcome, grade)` — 전이
- `checkSlaViolations(instances, now)` — 지연 식별
- `getAuditLog()`
