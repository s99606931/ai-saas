# SVC-AI-ADV-R553 Design — performance-management-automator-v2.ts
Plan Ref: SVC-AI-ADV-R553.plan.md
## 클래스 설계
```typescript
class PerformanceManagementAutomatorV2 {
  registerGoal(goalId, name, targetScore, period): PerformanceGoal
  recordEvaluation(goalId, evaluatorId, score, dataGrade?): void
  isAchieved(goalId): boolean  // avgScore >= targetScore
  getUnachievedGoals(): PerformanceGoal[]
  getAuditLog(): AuditEntry[]
}
```
