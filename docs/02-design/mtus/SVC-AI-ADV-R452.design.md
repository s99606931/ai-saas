# SVC-AI-ADV-R452 Design — 공공 데이터 이상치 감지기

Plan Ref: SVC-AI-ADV-R452.plan.md

```ts
export interface Dataset { readonly datasetId: string; readonly values: readonly number[]; }
export type Bound = 'LOW' | 'HIGH';
export interface Outlier { readonly index: number; readonly value: number; readonly bound: Bound; readonly recommended: number; }
export interface OutlierResult { readonly datasetId: string; readonly q1: number; readonly q3: number; readonly lowerBound: number; readonly upperBound: number; readonly outliers: readonly Outlier[]; }
```

IQR 공식: Q1/Q3 = 선형 보간, lower=Q1-1.5*IQR, upper=Q3+1.5*IQR
