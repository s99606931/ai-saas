# SVC-AI-ADV-R446 Design — 공공 에너지 소비 최적화 AI

Plan Ref: SVC-AI-ADV-R446.plan.md

```ts
export type BuildingUse = 'office' | 'school' | 'hospital';
export interface Building { readonly id: string; readonly area: number; readonly use: BuildingUse; readonly kwh: number; }
export interface OptimizationResult {
  readonly id: string;
  readonly ratio: number;
  readonly status: 'WASTE' | 'NORMAL';
  readonly recommendations: readonly string[];
}
```

기준: office=100, school=80, hospital=150 kWh/㎡
