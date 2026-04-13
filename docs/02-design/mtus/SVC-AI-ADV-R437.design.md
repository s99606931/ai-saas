# SVC-AI-ADV-R437 Design — Urban Plan Impact Analyzer AI

Plan Ref: SVC-AI-ADV-R437.plan.md

## 인터페이스
```ts
export interface UrbanPlan {
  readonly planId: string;
  readonly heightMeters: number;
  readonly expectedVehicles: number;
  readonly constructionMonths: number;
  readonly distanceToNearestBuilding: number;
}
export type Impact = 'LOW' | 'MEDIUM' | 'HIGH';
export interface ImpactReport {
  readonly planId: string;
  readonly traffic: { score: number; level: Impact };
  readonly noise: { score: number; level: Impact };
  readonly sunlight: { score: number; level: Impact };
  readonly recommendations: readonly string[];
}
```

## 임계값
- HIGH: score > 0.7
- MEDIUM: 0.3~0.7
- LOW: < 0.3
