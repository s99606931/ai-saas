# SVC-AI-ADV-R430 Design — Smart Grid Load Balancer AI

Plan Ref: SVC-AI-ADV-R430.plan.md

## 인터페이스
```ts
export interface Region {
  readonly regionId: string;
  readonly demandMW: number;
  readonly capacityMW: number;
}
export type Status = 'OVERLOAD' | 'NORMAL' | 'SLACK';
export interface Transfer {
  readonly from: string;
  readonly to: string;
  readonly mw: number;
}
export interface GridPlan {
  readonly statuses: ReadonlyArray<{ regionId: string; status: Status; loadRatio: number }>;
  readonly transfers: readonly Transfer[];
}
```

## 알고리즘
1. 각 지역 loadRatio 계산
2. 분류: >0.9 OVERLOAD, <0.5 SLACK, else NORMAL
3. OVERLOAD 지역별 overflow = demand - capacity*0.9
4. SLACK 지역에서 capacity*0.9 - demand = slack
5. greedy: overflow를 가장 큰 slack 지역에서 가져오기 (mw=min)
