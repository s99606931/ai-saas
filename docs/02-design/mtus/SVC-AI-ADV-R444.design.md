# SVC-AI-ADV-R444 Design — 공공 부동산 평가 AI

Plan Ref: SVC-AI-ADV-R444.plan.md

```ts
export type UseType = 'residential' | 'commercial' | 'land';
export interface Target { readonly area: number; readonly use: UseType; readonly year: number; }
export interface Comparable { readonly area: number; readonly use: UseType; readonly year: number; readonly price: number; }
export interface Appraisal { readonly estimatedPrice: number; readonly unitPrice: number; readonly usedCount: number; readonly confidence: number; }
```

가중치: w = max(1, 1 - (targetYear - compYear) * 0.1)
