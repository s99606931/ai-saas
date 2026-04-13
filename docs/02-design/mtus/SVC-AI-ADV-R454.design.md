# SVC-AI-ADV-R454 Design — 재난 복구 우선순위 결정기

Plan Ref: SVC-AI-ADV-R454.plan.md

```ts
export type Criticality = 'low' | 'med' | 'high';
export interface Facility {
  readonly id: string;
  readonly type: string;
  readonly damage: number;
  readonly residents: number;
  readonly criticality: Criticality;
}
export interface Priority {
  readonly id: string;
  readonly score: number;
  readonly rank: number;
  readonly urgent: boolean;
}
```

score = damage*0.4 + min(residents/10000,1)*0.3 + critW/3*0.3
