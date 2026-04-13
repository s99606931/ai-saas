# SVC-AI-ADV-R423 Design — Public Transport Optimizer

Plan Ref: SVC-AI-ADV-R423.plan.md

## 인터페이스
```ts
export interface RouteInput {
  readonly routeId: string;
  readonly passengers: number;
  readonly capacity: number;
  readonly headwayPerHour: number;
}
export type Action = 'INCREASE' | 'DECREASE' | 'MAINTAIN';
export interface RouteAdvice {
  readonly routeId: string;
  readonly loadRatio: number;
  readonly action: Action;
  readonly estimatedWaitMin: number;
}
```

## 알고리즘
- loadRatio = passengers / capacity
- >0.85 → INCREASE, <0.3 → DECREASE, else MAINTAIN
- estimatedWaitMin = 60 / max(headwayPerHour, 1)
- N2SF 차단 + 감사 로그
