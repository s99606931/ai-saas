# SVC-AI-ADV-R466 Design — 스마트 에너지 그리드 최적화

Plan Ref: SVC-AI-ADV-R466.plan.md

```ts
export interface Region {
  readonly id: string;
  readonly demandKw: number;
  readonly supplyKw: number;
}
export interface Transfer {
  readonly from: string;
  readonly to: string;
  readonly amountKw: number;
}
export interface GridPlan {
  readonly transfers: readonly Transfer[];
  readonly shortageRegions: readonly string[];
  readonly surplusRegions: readonly string[];
}
```
