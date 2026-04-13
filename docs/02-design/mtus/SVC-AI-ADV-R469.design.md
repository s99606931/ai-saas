# SVC-AI-ADV-R469 Design — 사회 서비스 자격 자동 심사

Plan Ref: SVC-AI-ADV-R469.plan.md

```ts
export interface Applicant {
  readonly id: string;
  readonly age: number;
  readonly householdSize: number;
  readonly monthlyIncome: number;
}
export interface EligibilityResult {
  readonly id: string;
  readonly eligibleServices: readonly string[];
  readonly reasons: Readonly<Record<string, string>>;
}
```
