# SVC-AI-ADV-R479 Design — realtime-service-health-index-ai.ts

Plan Ref: SVC-AI-ADV-R479.plan.md

```ts
export type HealthGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
export interface ServiceMetrics {
  readonly serviceId: string;
  readonly availability: number;    // 0~100
  readonly latencyScore: number;    // 0~100
  readonly errorScore: number;      // 0~100
  readonly saturationScore: number; // 0~100
}
export interface HealthIndex {
  readonly serviceId: string;
  readonly index: number;         // weighted composite
  readonly grade: HealthGrade;
  readonly weakestMetric: string; // name of lowest scoring metric
}
```

index = availability*0.4 + latencyScore*0.3 + errorScore*0.2 + saturationScore*0.1
grade: >=90 EXCELLENT, >=75 GOOD, >=60 FAIR, else POOR
weakestMetric: min(availability, latencyScore, errorScore, saturationScore) の metric name
