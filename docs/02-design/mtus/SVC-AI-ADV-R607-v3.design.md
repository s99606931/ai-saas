# SVC-AI-ADV-R607 (v3) Design — AI기반 예산 최적화 v3

## 인터페이스
```typescript
type BudgetPriority = 'HIGH' | 'MEDIUM' | 'LOW';
type BudgetAction = 'REDUCE' | 'INCREASE' | 'HOLD';

interface BudgetItem {
  id: string;
  allocated: number;
  spent: number;
  priority: BudgetPriority;
}

interface BudgetItemResult {
  id: string;
  utilization: number;
  action: BudgetAction;
}

interface BudgetOptimizationResult {
  totalAllocated: number;
  totalSpent: number;
  overallUtilization: number;
  items: BudgetItemResult[];
}

class BudgetOptimizationAiV3 {
  optimize(items: BudgetItem[]): BudgetOptimizationResult;
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
- 각 항목 utilization = allocated > 0 ? spent/allocated : 0.
- action 매핑은 FR 기준.
- overallUtilization = totalSpent / totalAllocated (totalAllocated=0 → 0).
