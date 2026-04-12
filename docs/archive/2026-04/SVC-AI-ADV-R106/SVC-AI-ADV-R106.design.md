# SVC-AI-ADV-R106 — Conversational Form Filler (Design)

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)

## 1. 구성

```typescript
type FieldType = 'text' | 'number' | 'date' | 'phone' | 'email' | 'rrn' | 'enum'

interface FormField {
  id: string
  label: string
  type: FieldType
  required: boolean
  options?: string[]      // enum 전용
  pattern?: string        // text regex
  pii?: boolean           // PII 여부 → 저장 시 마스킹
}

interface FormSchema {
  formId: string
  title: string
  fields: FormField[]
}

interface FormSession {
  sessionId: string
  formId: string
  slots: Record<string, string>   // 채워진 값 (마스킹 포함)
  startedAt: string
}
```

## 2. 슬롯 추출 규칙

- 각 FormField의 `label`을 키워드로 문장에서 라벨-값 쌍 탐지
- 패턴: `<label>[:：는은]? <value>`
- 타입별 추가 검증:
  - `phone`: `01X-XXXX-XXXX` 형태
  - `email`: RFC 간소화
  - `rrn`: 6자리-7자리, 저장 시 마스킹 `000000-0******`
  - `number`: 숫자 파싱
  - `date`: ISO 또는 `YYYY-MM-DD`
  - `enum`: options 포함 여부

## 3. 마스킹 규칙

- `pii: true` → 저장 시 타입별 마스킹:
  - rrn: `xxxxxx-x******`
  - phone: `01X-****-XXXX`
  - email: `u***@domain`

## 4. Design Anchor

- CSAP D-06 감사 로그
- N2SF N-05 C/S 차단
