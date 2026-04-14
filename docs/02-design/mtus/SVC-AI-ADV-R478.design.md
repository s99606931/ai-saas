# SVC-AI-ADV-R478 Design — api-performance-optimizer-v3.ts

Plan Ref: SVC-AI-ADV-R478.plan.md

```ts
export type ApiStatus = 'CRITICAL' | 'WARNING' | 'HEALTHY';
export type Recommendation = 'CACHE' | 'RATE_LIMIT' | 'NONE';
export interface ApiMetric {
  readonly apiId: string;
  readonly avgResponseMs: number;
  readonly p99ResponseMs: number;
  readonly errorRate: number;   // 0~1
  readonly callsPerMin: number;
}
export interface ApiOptimizationResult {
  readonly apiId: string;
  readonly status: ApiStatus;
  readonly score: number;
  readonly recommendations: readonly Recommendation[];
}
```

status: p99>2000||errorRate>0.05 → CRITICAL, p99>1000||errorRate>0.01 → WARNING, else HEALTHY
score = max(0, 100 - min(p99ResponseMs/20, 50) - min(errorRate*1000, 50))
recommendations: CRITICAL → ['CACHE','RATE_LIMIT'], WARNING → ['CACHE'], HEALTHY → []
