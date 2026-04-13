# SVC-AI-ADV-R426 Design — Workforce Planning AI

Plan Ref: SVC-AI-ADV-R426.plan.md

## 인터페이스
```ts
export interface DeptStatus {
  readonly deptId: string;
  readonly workload: number;
  readonly headcount: number;
}
export type PlanAction = 'INCREASE' | 'DECREASE' | 'MAINTAIN';
export interface PlanAdvice {
  readonly deptId: string;
  readonly loadPerHead: number;
  readonly action: PlanAction;
  readonly neededDelta: number;
}
```

## 알고리즘
- loadPerHead = workload / max(headcount,1)
- threshold 인자 (기본 100)
- > threshold*1.2 → INCREASE, < threshold*0.6 → DECREASE
- neededDelta = round(workload/threshold) - headcount
- top3: INCREASE 필요한 delta 큰 순
