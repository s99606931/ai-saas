# SVC-AI-ADV-R425 Design — Tax Compliance Checker AI

Plan Ref: SVC-AI-ADV-R425.plan.md

## 인터페이스
```ts
export interface TaxFiling {
  readonly filingId: string;
  readonly taxpayerId: string;
  readonly income: number;
  readonly deduction: number;
  readonly declaredTax: number;
  readonly calculatedTax: number;
}
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface Issue {
  readonly code: string;
  readonly severity: Severity;
  readonly message: string;
}
export interface CheckResult {
  readonly filingId: string;
  readonly compliant: boolean;
  readonly issues: readonly Issue[];
}
```

## 규칙
- 필수 필드 누락 → MISSING_FIELD/CRITICAL
- deduction > income*0.5 → OVER_DEDUCTION/HIGH
- |declared-calculated| > 100 → CALC_MISMATCH/MEDIUM
- compliant: CRITICAL/HIGH 이슈 없을 때 true
