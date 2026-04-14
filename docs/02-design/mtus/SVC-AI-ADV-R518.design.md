# SVC-AI-ADV-R518 Design — multitenant-resource-fairness-verifier.ts

Plan Ref: SVC-AI-ADV-R518.plan.md

```ts
export type FairnessStatus = 'OVER_QUOTA' | 'UNDER_UTILIZED' | 'FAIR';
export interface TenantResource {
  readonly tenantId: string;
  readonly cpuAlloc: number;
  readonly memAllocGB: number;
  readonly storageGB: number;
  readonly quota: { readonly cpu: number; readonly mem: number; readonly storage: number };
}
export interface TenantFairness {
  readonly tenantId: string;
  readonly cpuStatus: FairnessStatus;
  readonly memStatus: FairnessStatus;
  readonly storageStatus: FairnessStatus;
  readonly overallStatus: FairnessStatus;
}
export interface FairnessReport {
  readonly tenants: readonly TenantFairness[];
  readonly fairnessScore: number;  // FAIR tenants / total * 100
}
```

utilizationRate = actual/quota*100
>110→OVER_QUOTA, <10→UNDER_UTILIZED, else FAIR
overallStatus: any OVER_QUOTA→OVER_QUOTA, any UNDER_UTILIZED→UNDER_UTILIZED, else FAIR
