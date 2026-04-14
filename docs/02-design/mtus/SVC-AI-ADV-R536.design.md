# SVC-AI-ADV-R536 Design — budget-planning-assistant-v2.ts
Plan Ref: SVC-AI-ADV-R536.plan.md
## 클래스 설계
```typescript
class BudgetPlanningAssistantV2 {
  registerItem(itemId, name, category, allocatedAmount): BudgetItem
  recordSpending(itemId, spentAmount, dataGrade?): void
  getExecutionRate(itemId): number  // totalSpent/allocatedAmount*100
  getOverBudgetItems(): BudgetItem[]  // totalSpent > allocatedAmount
  getAuditLog(): AuditEntry[]
}
```
