# SVC-AI-ADV-R463 Design — 공중 보건 비상 조기 탐지기

Plan Ref: SVC-AI-ADV-R463.plan.md

```ts
export interface SymptomReport {
  readonly date: string;
  readonly symptom: string;
  readonly count: number;
  readonly regionId: string;
}
export interface Anomaly {
  readonly symptom: string;
  readonly regionId: string;
  readonly recentCount: number;
  readonly baseline: number;
  readonly ratio: number;
}
export type AlertLevel = 'normal'|'warning'|'critical';
export interface DetectResult {
  readonly alertLevel: AlertLevel;
  readonly anomalies: readonly Anomaly[];
}
```
