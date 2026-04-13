# SVC-AI-ADV-R455 Design — AI 기반 인허가 자동 처리

Plan Ref: SVC-AI-ADV-R455.plan.md

```ts
export type PermitType = 'building' | 'business' | 'environment';
export interface Application {
  readonly id: string;
  readonly type: PermitType;
  readonly applicant: string;
  readonly documents: readonly string[];
}
export type Decision = 'APPROVED' | 'NEED_DOCS' | 'REVIEW';
export interface ProcessResult {
  readonly id: string;
  readonly decision: Decision;
  readonly missing: readonly string[];
}
```
