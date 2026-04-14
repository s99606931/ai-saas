# SVC-AI-ADV-R476 Design — service-capacity-predictor-v2.ts

Plan Ref: SVC-AI-ADV-R476.plan.md

```ts
export type Window = 'day' | 'week' | 'month';
export type ServiceStatus = 'OVERLOADED' | 'WARNING' | 'HEALTHY';
export interface CapacityMetric {
  readonly serviceId: string;
  readonly cpuUsage: number;    // 0~100
  readonly memUsage: number;    // 0~100
  readonly requestRate: number; // req/min
  readonly window: Window;
  readonly growthRate: number;  // 0~1 (e.g. 0.1 = 10% growth)
}
export interface CapacityForecast {
  readonly serviceId: string;
  readonly status: ServiceStatus;
  readonly recommendedCapacity: number; // requestRate * (1 + growthRate * 1.2)
}
```

status: cpu>80||mem>80 → OVERLOADED, >60 → WARNING, else HEALTHY
recommendedCapacity = round(requestRate * (1 + growthRate * 1.2))
