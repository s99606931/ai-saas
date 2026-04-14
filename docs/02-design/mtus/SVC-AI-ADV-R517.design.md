# SVC-AI-ADV-R517 Design — workflow-bottleneck-detector-ai.ts

Plan Ref: SVC-AI-ADV-R517.plan.md

```ts
export type StepStatus = 'BOTTLENECK' | 'WARNING' | 'NORMAL';
export type BottleneckSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NONE';
export interface WorkflowStep {
  readonly stepId: string;
  readonly name: string;
  readonly avgDurationMin: number;
  readonly expectedDurationMin: number;
  readonly queueSize: number;
}
export interface StepAnalysis {
  readonly stepId: string;
  readonly status: StepStatus;
  readonly severity: BottleneckSeverity;
}
export interface WorkflowReport {
  readonly steps: readonly StepAnalysis[];
  readonly healthScore: number;  // NORMAL steps / total * 100
  readonly criticalSteps: readonly string[];
}
```

status: avg>expected*1.5→BOTTLENECK, avg>expected*1.2→WARNING, else NORMAL
severity: avg>expected*2||queueSize>50→CRITICAL, BOTTLENECK→HIGH, WARNING→MEDIUM, NORMAL→NONE
