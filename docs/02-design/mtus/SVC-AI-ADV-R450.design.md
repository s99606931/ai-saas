# SVC-AI-ADV-R450 Design — 공공 서비스 품질 벤치마크 AI

Plan Ref: SVC-AI-ADV-R450.plan.md

```ts
export interface Metrics { readonly satisfaction: number; readonly response: number; readonly coverage: number; readonly transparency: number; }
export interface Agency { readonly id: string; readonly metrics: Metrics; }
export interface Ranked { readonly id: string; readonly score: number; readonly rank: number; }
export interface BenchmarkReport { readonly rankings: readonly Ranked[]; readonly average: number; }
```
