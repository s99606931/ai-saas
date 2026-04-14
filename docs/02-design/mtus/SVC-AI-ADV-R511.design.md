# SVC-AI-ADV-R511 Design — service-autoscaling-policy-optimizer.ts

Plan Ref: SVC-AI-ADV-R511.plan.md

```ts
export type ScaleAction = 'SCALE_OUT' | 'SCALE_IN' | 'MAINTAIN';
export type SloRisk = 'HIGH_RISK' | 'LOW_RISK';
export interface ScalingMetric {
  readonly serviceId: string;
  readonly cpuAvg: number;
  readonly memAvg: number;
  readonly rpsAvg: number;
  readonly rpsP95: number;
  readonly sloTarget: number; // 0~1
}
export interface ScalingPolicy {
  readonly serviceId: string;
  readonly action: ScaleAction;
  readonly recommendedInstances: number;
  readonly sloRisk: SloRisk;
}
```

action: rpsP95>rpsAvg*2||cpuAvg>75 → SCALE_OUT, cpuAvg<30&&memAvg<30 → SCALE_IN, else MAINTAIN
recommendedInstances = ceil(rpsAvg/100) + (SCALE_OUT: +2, SCALE_IN: -1, MAINTAIN: 0), min 1
sloRisk: sloTarget<0.99&&action==='SCALE_IN' → HIGH_RISK, else LOW_RISK
