# SVC-AI-ADV-R468 Design — 공공 토지 이용 최적화

Plan Ref: SVC-AI-ADV-R468.plan.md

```ts
export type LandDemand = 'housing'|'commerce'|'park'|'industry';
export interface Parcel {
  readonly id: string;
  readonly areaSqm: number;
  readonly accessScore: number;
  readonly demand: LandDemand;
  readonly currentUse: string;
  readonly restricted: boolean;
}
export interface LandRecommendation {
  readonly id: string;
  readonly recommendedUse: string;
  readonly utilityScore: number;
  readonly convertible: boolean;
}
```
