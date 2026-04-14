# SVC-AI-ADV-R515 Design — deployment-approval-automator-ai.ts

Plan Ref: SVC-AI-ADV-R515.plan.md

```ts
export type Environment = 'dev' | 'stg' | 'prod';
export type ApprovalDecision = 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
export interface DeployRequest {
  readonly deployId: string;
  readonly service: string;
  readonly environment: Environment;
  readonly testsPassed: boolean;
  readonly changedFiles: number;
  readonly hasRollbackPlan: boolean;
}
export interface ApprovalResult {
  readonly deployId: string;
  readonly decision: ApprovalDecision;
  readonly riskScore: number;
  readonly reasons: readonly string[];
}
```

riskScore: env(prod:40,stg:10,dev:0) + !testsPassed:30 + changedFiles(>20:20,>10:10) + !hasRollbackPlan:15
decision: <30→AUTO_APPROVE, <60→MANUAL_REVIEW, ≥60→REJECT
reasons: list of triggered risk factors
