# SVC-AI-ADV-R442 Design — AI 기반 공공 보건 트렌드 분석기

Plan Ref: SVC-AI-ADV-R442.plan.md

```ts
export interface TrendInput { readonly category: string; readonly weeks: readonly number[]; }
export interface TrendReport {
  readonly category: string;
  readonly spikes: readonly number[]; // week index
  readonly growthPct: number;
  readonly status: 'SPIKE' | 'STABLE';
}
```

알고리즘: i ≥ 3에서 ma = (w[i-3]+w[i-2]+w[i-1]+w[i])/4 계산. w[i]/ma >= 1.5 이면 스파이크. growthPct = (last - first)/first * 100 (first=0 이면 0).
