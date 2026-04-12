# MTU Design — SVC-AI-ADV-R152 Output Regression Detector

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R152.plan.md

## 아키텍처: Golden Set Comparator

```
addGolden(id, input, expected) → goldens.set(id, {...})
submitCandidate(id, output) → candidates.set(id, output)
evaluate(threshold=0.7, blockThreshold=0.1):
  for each golden:
    if no candidate → regressed (similarity=0, reason=missing)
    else compute jaccard(expected, actual)
    if sim < threshold → regressed
  rate = regressed / total
  shouldBlock = rate > blockThreshold
```

## 유사도 (Jaccard)

```
tokenize(text) = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
A = tokens(expected), B = tokens(actual)
jaccard = |A ∩ B| / |A ∪ B|
```

양쪽 빈 경우 → 1. 한쪽만 빈 경우 → 0.

## 타입

```ts
export interface GoldenCase {
  id: string
  input: string
  expectedOutput: string
}

export interface CaseResult {
  id: string
  similarity: number
  regressed: boolean
  reason?: 'missing' | 'low_similarity'
}

export interface EvaluationReport {
  total: number
  passCount: number
  regressionCount: number
  regressionRate: number
  shouldBlock: boolean
  cases: CaseResult[]
}
```

## API

```ts
class OutputRegressionDetector {
  addGolden(id: string, input: string, expected: string, grade?: DataGrade): void
  submitCandidate(id: string, output: string): void
  evaluate(threshold?: number, blockThreshold?: number): EvaluationReport
  reset(): void
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 중복 id: `duplicate_golden`
- 미등록 id submit: `golden_not_found`
- 빈 input/expected/output: `invalid_input`
- C/S등급: `grade_blocked`
