# SVC-AI-ADV-R459 Design — 스마트 폐기물 관리 AI

Plan Ref: SVC-AI-ADV-R459.plan.md

```ts
export interface Bin {
  readonly id: string;
  readonly fillLevel: number;
  readonly x: number;
  readonly y: number;
}
export interface Route {
  readonly path: readonly string[];
  readonly totalDistance: number;
  readonly overflow: boolean;
}
```

nearest-neighbor 탐욕법 + fillLevel >=0.8 필터
