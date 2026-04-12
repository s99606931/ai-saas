# SVC-AI-ADV-R132 — 예산 최적화 엔진 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R132.plan.md

## 1. 아키텍처

```
registerBudget → recordExpense
      ↓
BudgetOptimizerAi
  ├─ analyzeExecution() — 집행률 계산 + 과잉/미달 분류
  ├─ suggestReallocation() — 미달 → 과잉 재배분 제안
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export interface BudgetItem { itemId: string; name: string; allocated: number; category: string }
export interface ExecutionStatus { itemId: string; allocated: number; spent: number
  executionRate: number; status: 'OVER' | 'UNDER' | 'NORMAL' }
export interface ReallocationSuggestion {
  fromItemId: string; toItemId: string; amount: number; reason: string }
```

## 3. 알고리즘

### §3.1 집행률: `spent / allocated`
### §3.2 분류: rate > 0.95 → OVER, rate < 0.50 → UNDER, else NORMAL
### §3.3 재배분: UNDER 항목의 미집행 잔액 → OVER 항목으로 제안 (소액 우선)

## 4. Design Anchor

- CSAP D-06: 분석 감사 로그
