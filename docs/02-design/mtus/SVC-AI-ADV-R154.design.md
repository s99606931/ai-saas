# MTU Design — SVC-AI-ADV-R154 Adversarial Input Detector

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R154.plan.md

## 아키텍처: Signature-based Scanner

```
detect(input):
  categories = []
  if has zero-width chars → push 'zero_width'
  if /(.)\1{49,}/.test(input) → push 'repetition'
  if input.length > maxLength → push 'oversize'
  ratio = controlChars / input.length
  if ratio > 0.05 → push 'abnormal_unicode'
  if /([A-Za-z0-9+/=]{2000,})/.test(input) → push 'encoded_payload'
  score = min(categories.length * 0.25, 1.0)
  verdict = score >= 0.5 ? 'block' : score >= 0.25 ? 'warn' : 'pass'
```

## 타입

```ts
export type Category =
  | 'zero_width'
  | 'repetition'
  | 'oversize'
  | 'abnormal_unicode'
  | 'encoded_payload'

export type Verdict = 'pass' | 'warn' | 'block'

export interface DetectionResult {
  verdict: Verdict
  categories: Category[]
  score: number
  sample: string
}
```

## API

```ts
class AdversarialInputDetector {
  detect(input: string, grade?: DataGrade): DetectionResult
  shouldBlock(result: DetectionResult): boolean
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 빈 입력: `invalid_input`
- C/S 등급: `grade_blocked`
