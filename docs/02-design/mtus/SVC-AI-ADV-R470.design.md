# SVC-AI-ADV-R470 Design — 부처 간 자금 이체 AI

Plan Ref: SVC-AI-ADV-R470.plan.md

```ts
export interface Account {
  readonly agency: string;
  balance: number;
  readonly dailyLimit: number;
  usedToday: number;
}
export interface TransferRequest {
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly approvalCode: string;
}
export interface TransferResult {
  readonly success: boolean;
  readonly reason?: string;
  readonly newFromBalance: number;
  readonly newToBalance: number;
}
```
