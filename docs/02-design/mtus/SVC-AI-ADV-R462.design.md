# SVC-AI-ADV-R462 Design — AI 기반 도시 교통 신호 제어기

Plan Ref: SVC-AI-ADV-R462.plan.md

```ts
export type Direction = 'N'|'S'|'E'|'W';
export interface Intersection {
  readonly id: string;
  readonly directions: Readonly<Record<Direction, number>>;
}
export interface SignalPlan {
  readonly id: string;
  readonly greenTimes: Readonly<Record<Direction, number>>;
  readonly totalCycleSec: number;
  readonly priorityDir: Direction;
}
```
