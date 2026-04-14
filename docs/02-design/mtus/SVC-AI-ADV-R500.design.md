# SVC-AI-ADV-R500 Design — security-patch-prioritizer-v2.ts

Plan Ref: SVC-AI-ADV-R500.plan.md

## 클래스 설계

```typescript
type PatchStatus = 'pending' | 'applied' | 'deferred'

class SecurityPatchPrioritizerV2 {
  registerPatch(patchId, title, cvssScore, affectedSystems[]): SecurityPatch
  updateStatus(patchId, status, dataGrade?): void
  getPriorityScore(patchId): number   // cvssScore*10 + affectedSystems.length*5
  getPrioritizedPatches(): SecurityPatch[]  // score 내림차순
  getAuditLog(): AuditEntry[]
}
```

## 우선순위 점수
`priorityScore = cvssScore * 10 + affectedSystems.length * 5`
