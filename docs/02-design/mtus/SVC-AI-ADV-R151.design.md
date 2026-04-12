# MTU Design — SVC-AI-ADV-R151 Document Redaction Engine

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R151.plan.md

## 아키텍처: Regex Pipeline

각 PII 타입별 정규식을 순차 적용 → 누적 hits → 최종 redacted 문자열 반환.

```
text → rrn → email → phone → account → passport → classified_keyword
    → hits 누적
    → return { redacted, hits, totalHits }
```

## 정규식 패턴

| Type | Pattern |
|------|---------|
| rrn | `\b\d{6}-\d{7}\b` |
| email | `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` |
| phone | `\b(0\d{1,2})-\d{3,4}-\d{4}\b` |
| account | `\b\d{2,6}-\d{2,6}-\d{2,6}\b` (전화와 중복 → phone 먼저 적용) |
| passport | `\b[A-Z]\d{8}\b` |
| classified | `(대외비|기밀|CONFIDENTIAL|SECRET)` |

## 타입

```ts
export type PiiType = 'rrn' | 'email' | 'phone' | 'account' | 'passport' | 'classified'

export interface RedactionHit {
  type: PiiType
  value: string
  index: number
}

export interface RedactResult {
  redacted: string
  hits: RedactionHit[]
  totalHits: number
}
```

## API

```ts
class DocumentRedactionEngine {
  redact(text: string, grade?: DataGrade): RedactResult
  getAuditLog(): AuditEntry[]
}
```

## 처리 순서 중요성

phone과 account는 겹칠 수 있으므로 **phone 먼저** 적용 후 account 처리.
비밀등급 키워드는 case-insensitive.

## 예외

- 빈 text: `invalid_input`
- C/S등급: `grade_blocked`
