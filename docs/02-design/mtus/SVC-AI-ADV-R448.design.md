# SVC-AI-ADV-R448 Design — 공공 계약 이행 모니터

Plan Ref: SVC-AI-ADV-R448.plan.md

```ts
export interface Milestone { readonly id: string; readonly dueDate: string; readonly progress: number; readonly weight: number; }
export type MilestoneStatus = 'DONE' | 'ON_TRACK' | 'AT_RISK' | 'OVERDUE';
export interface ContractReport {
  readonly overallProgress: number;
  readonly statuses: readonly { id: string; status: MilestoneStatus }[];
}
```

today 기준 판정 — today는 주입 가능 (테스트 편의)
