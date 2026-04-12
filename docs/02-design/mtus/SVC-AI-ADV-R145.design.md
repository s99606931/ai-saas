# MTU Design — SVC-AI-ADV-R145 Document Intent Classifier

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R145.plan.md

## 아키텍처: Rule-Based Scoring

단순 키워드 가중치 기반 스코어링. 외부 임베딩 의존 없이 결정론적.

## 타입

```ts
export interface IntentDefinition {
  label: string
  keywords: Array<{ term: string; weight: number }>
}

export interface IntentScore {
  label: string
  score: number
  matches: string[]
}

export interface ClassifyResult {
  top: IntentScore | { label: 'unknown'; score: 0; matches: [] }
  all: IntentScore[]
}
```

## API

```ts
class DocumentIntentClassifier {
  register(intent: IntentDefinition): void
  classify(text: string, grade?: DataGrade, options?: {
    threshold?: number
    topK?: number
  }): ClassifyResult
  getAuditLog(): AuditEntry[]
}
```

## 스코어링 알고리즘

1. 입력 텍스트 소문자 정규화
2. 각 intent 키워드 순회
3. 키워드 포함 시: score += weight
4. 정렬 후 top-K 반환
5. 최고 score < threshold 이면 unknown

## 예외

- 빈 텍스트: `invalid_text`
- 동일 label 중복 등록: `duplicate_intent`
- C/S등급: `grade_blocked`
