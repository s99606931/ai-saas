# SVC-AI-ADV-R453 Design — 예산 집행 심층 분석 v2

Plan Ref: SVC-AI-ADV-R453.plan.md

```ts
export interface BudgetEntry {
  readonly dept: string;
  readonly item: string;
  readonly allocated: number;
  readonly spent: number;
  readonly monthsElapsed: number;
  readonly monthsTotal: number;
}
export type Warning = 'UNDER' | 'OVER' | 'CARRYOVER_RISK' | 'NONE';
export interface AnalyzedEntry { readonly dept: string; readonly item: string; readonly execRate: number; readonly expectedRate: number; readonly warning: Warning; }
export interface DeptSummary { readonly dept: string; readonly avgExecRate: number; readonly warnings: number; }
export interface AnalysisResult { readonly entries: readonly AnalyzedEntry[]; readonly deptSummaries: readonly DeptSummary[]; }
```
