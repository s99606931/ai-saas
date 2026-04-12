# MTU Design — SVC-AI-ADV-R155 Context Budget Optimizer

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R155.plan.md

## 아키텍처: Greedy by Priority

```
selectWithinBudget(budget):
  sorted = items.sort((a,b) => b.priority - a.priority || a.tokens - b.tokens)
  used = 0
  selected = []
  dropped = []
  for it of sorted:
    if used + it.tokens <= budget:
      selected.push(it); used += it.tokens
    else:
      dropped.push(it.id)
  return { selected, dropped, usedTokens: used, utilization: used/budget }
```

## 타입

```ts
export interface ContextItem {
  id: string
  content: string
  tokens: number
  priority: number
}

export interface SelectionResult {
  selected: ContextItem[]
  dropped: string[]
  usedTokens: number
  utilization: number
}
```

## API

```ts
class ContextBudgetOptimizer {
  addItem(id: string, content: string, tokens: number, priority: number, grade?: DataGrade): void
  selectWithinBudget(budget: number): SelectionResult
  reset(): void
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 중복 id → `duplicate_item`
- 빈 content → `invalid_input`
- tokens <= 0 → `invalid_tokens`
- budget <= 0 → `invalid_budget`
- C/S 등급 → `grade_blocked`
