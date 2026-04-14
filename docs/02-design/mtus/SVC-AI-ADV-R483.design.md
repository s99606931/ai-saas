# SVC-AI-ADV-R483 Design — service-registry-automator-v2.ts

Plan Ref: SVC-AI-ADV-R483.plan.md

```ts
export type HealthStatus = 'UP' | 'DOWN' | 'DEGRADED';
export type RegistryStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
export interface ServiceEntry {
  readonly serviceId: string;
  readonly name: string;
  readonly version: string;
  readonly endpoint: string;
  readonly healthCheckUrl: string;
}
export interface ServiceHealth {
  readonly serviceId: string;
  readonly status: HealthStatus;
  readonly responseMs: number;
  readonly registryStatus: RegistryStatus;
}
export interface RegistrySnapshot {
  readonly total: number;
  readonly healthy: number;
  readonly unhealthy: number;
  readonly services: readonly ServiceHealth[];
}
```

registryStatus: DOWN||responseMs>5000 → UNHEALTHY, DEGRADED → DEGRADED, else HEALTHY
