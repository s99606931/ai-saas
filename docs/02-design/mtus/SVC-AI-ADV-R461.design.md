# SVC-AI-ADV-R461 Design — 공공 안전 사건 자동 추적기

Plan Ref: SVC-AI-ADV-R461.plan.md

```ts
export interface Incident {
  readonly id: string;
  readonly category: string;
  readonly regionId: string;
  readonly timestamp: string;
  readonly severity: 1|2|3|4|5;
}
export interface PatternAlert {
  readonly category: string;
  readonly regionId: string;
  readonly count: number;
  readonly avgSeverity: number;
  readonly hotspot: boolean;
}
export interface TrackResult {
  readonly totalIncidents: number;
  readonly alerts: readonly PatternAlert[];
  readonly topRiskRegion: string | null;
}
```
