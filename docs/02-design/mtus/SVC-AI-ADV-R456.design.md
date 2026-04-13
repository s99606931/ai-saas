# SVC-AI-ADV-R456 Design — 지자체 부채 위험도 평가기

Plan Ref: SVC-AI-ADV-R456.plan.md

```ts
export interface Finance {
  readonly region: string;
  readonly debtRatio: number;
  readonly repaymentRatio: number;
  readonly reserveRatio: number;
}
export type Grade = 'SAFE' | 'CAUTION' | 'WARNING' | 'CRITICAL';
export interface Assessment {
  readonly region: string;
  readonly score: number;
  readonly grade: Grade;
}
```
