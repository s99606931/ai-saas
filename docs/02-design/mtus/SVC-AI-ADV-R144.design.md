# MTU Design — SVC-AI-ADV-R144 Tenant Billing Reporter

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R144.plan.md

## 아키텍처: Pragmatic Balance

인메모리 사용량 배열 + 단가 Map + 테넌트 할인 Map. 결정론적 산출.

## 타입

```ts
export interface UsageRecord {
  tenantId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  at: number
}

export interface ModelRate {
  modelId: string
  inputPerK: number
  outputPerK: number
  currency: 'KRW'
}

export interface BillingLine {
  modelId: string
  inputTokens: number
  outputTokens: number
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export interface BillingReport {
  tenantId: string
  periodStart: number
  periodEnd: number
  lines: BillingLine[]
  totalGross: number
  totalDiscount: number
  totalNet: number
  currency: 'KRW'
}
```

## API

```ts
class TenantBillingReporter {
  setRate(rate: ModelRate): void
  setDiscount(tenantId: string, rate: number): void  // 0..0.5
  record(usage: UsageRecord, grade?: DataGrade): void
  generate(tenantId: string, periodStart: number, periodEnd: number): BillingReport
  getAuditLog(): AuditEntry[]
}
```

## 계산식

- line.gross = (inputTokens/1000 * inputPerK) + (outputTokens/1000 * outputPerK)
- discount = gross * tenantDiscountRate
- net = gross - discount
- 총액은 라인 합산, 소수 둘째 자리 반올림(원 단위 정수 처리)

## 예외

- 미등록 모델: `rate_missing`
- 할인율 범위 밖: `invalid_discount`
- periodEnd < periodStart: `invalid_period`
- 음수 토큰: `invalid_tokens`
- C/S등급: `grade_blocked`
