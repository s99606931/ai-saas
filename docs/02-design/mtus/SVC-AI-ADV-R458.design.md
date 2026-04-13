# SVC-AI-ADV-R458 Design — 공공기관 AI 준비도 평가

Plan Ref: SVC-AI-ADV-R458.plan.md

```ts
export interface Assessment {
  readonly data: number;
  readonly infra: number;
  readonly talent: number;
  readonly governance: number;
}
export type Level = 'INITIAL' | 'EMERGING' | 'PROGRESSING' | 'ADVANCED';
export interface ReadinessResult {
  readonly score: number;
  readonly level: Level;
  readonly weakestArea: string;
}
```
