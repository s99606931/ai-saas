# SVC-AI-ADV-R449 Design — AI 기반 재정 감사 자동화

Plan Ref: SVC-AI-ADV-R449.plan.md

```ts
export type ExpenseCategory = 'travel' | 'meal' | 'office';
export interface Expense { readonly id: string; readonly amount: number; readonly category: ExpenseCategory; readonly evidence: readonly string[]; readonly date: string; }
export type Reason = 'OVER_LIMIT' | 'NO_EVIDENCE' | 'DUPLICATE';
export interface Finding { readonly id: string; readonly reasons: readonly Reason[]; readonly risk: 'HIGH' | 'MED' | 'LOW'; }
export interface AuditResult { readonly total: number; readonly flagged: number; readonly findings: readonly Finding[]; }
```

한도: travel=500000, meal=100000, office=200000
