# MTU Design — SVC-AI-ADV-R156 Response Consistency Checker

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R156.plan.md

## 아키텍처: Pairwise Jaccard Consistency

```
normalize(q) = q.trim().toLowerCase()
record(q, a) → map[normalize(q)].push(a) (cap 10 FIFO)

check(q, threshold=0.6):
  answers = map[normalize(q)] or throw not_found
  if answers.length == 1 → score=1, passed=true
  pairs = C(n,2)
  sumSim = sum(jaccard(ai, aj))
  score = sumSim / pairs
  passed = score >= threshold
```

## Jaccard 토큰

```
tokens(text) = Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
```

## 타입

```ts
export interface ConsistencyResult {
  question: string
  sampleCount: number
  score: number
  passed: boolean
}

export interface ConsistencyReport {
  questions: number
  passedCount: number
  failedCount: number
  averageScore: number
  details: ConsistencyResult[]
}
```

## API

```ts
class ResponseConsistencyChecker {
  record(question: string, answer: string, grade?: DataGrade): void
  check(question: string, threshold?: number): ConsistencyResult
  generateReport(threshold?: number): ConsistencyReport
  reset(): void
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 빈 질문/응답 → `invalid_input`
- 미기록 질문 → `not_found`
- threshold 범위 위반 → `invalid_threshold`
- C/S → `grade_blocked`
