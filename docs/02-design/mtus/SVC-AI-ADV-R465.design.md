# SVC-AI-ADV-R465 Design — 인프라 장애 예측기

Plan Ref: SVC-AI-ADV-R465.plan.md

```ts
export type FacilityType = 'bridge'|'tunnel'|'water';
export interface Facility {
  readonly id: string;
  readonly type: FacilityType;
  readonly ageYears: number;
  readonly crackIndex: number;
  readonly vibration: number;
  readonly corrosion: number;
}
export type RiskLevel = 'low'|'mid'|'high';
export interface FailurePrediction {
  readonly id: string;
  readonly failureProbability: number;
  readonly riskLevel: RiskLevel;
  readonly inspectionPriority: 1|2|3|4|5;
}
```
