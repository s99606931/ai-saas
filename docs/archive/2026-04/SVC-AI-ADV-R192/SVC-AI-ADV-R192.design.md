# SVC-AI-ADV-R192 — 예산 집행 이상 탐지기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export interface BudgetItem { itemId: string; department: string; annualBudget: number; name: string }
export interface Expenditure { itemId: string; date: string; amount: number; description: string }
export interface AnomalyExpenditure { itemId: string; date: string; amount: number; zScore: number; reason: string }
export interface BudgetReport { itemId: string; name: string; annualBudget: number; totalSpent: number; executionRate: number; anomalies: AnomalyExpenditure[] }
class BudgetAnomalyDetector {
  registerItem(item: BudgetItem): void
  recordExpenditure(exp: Expenditure): void
  detectAnomalies(itemId: string): AnomalyExpenditure[]
  getReport(itemId: string): BudgetReport
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘
- Z-score: (amount - mean) / std > 2.0 → 이상
- executionRate: totalSpent / annualBudget
