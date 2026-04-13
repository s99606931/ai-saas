# SVC-AI-ADV-R440 Design — Smart City Integrated Dashboard AI

Plan Ref: SVC-AI-ADV-R440.plan.md

## 인터페이스
```ts
export interface KPI {
  readonly domain: string;
  readonly name: string;
  readonly value: number;
  readonly baseline: number;
  readonly stddev: number;
}
export interface Anomaly {
  readonly domain: string;
  readonly name: string;
  readonly z: number;
}
export interface Snapshot {
  readonly cityIndex: number;
  readonly domainScores: Record<string, number>;
  readonly anomalies: readonly Anomaly[];
  readonly totalKpis: number;
}
```
