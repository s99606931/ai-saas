# SVC-AI-ADV-R443 Design — 지능형 교육 지원 시스템

Plan Ref: SVC-AI-ADV-R443.plan.md

```ts
export interface Student { readonly id: string; readonly scores: Record<string, number>; }
export interface StudentPlan {
  readonly id: string;
  readonly weakSubjects: readonly string[];
  readonly recommendations: readonly string[];
}
export interface CohortReport {
  readonly cohortAvg: Record<string, number>;
  readonly plans: readonly StudentPlan[];
}
```
