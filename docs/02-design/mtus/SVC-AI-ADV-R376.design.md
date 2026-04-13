# SVC-AI-ADV-R376 Design: AI기반 공공기관 의사결정 지원 시스템

## 핵심 알고리즘

### 가중 합산 점수 계산
- `weightSum = sum(criterion.weight for all criteria)`
- `totalScore = sum(alt.scores[c.id] * c.weight / weightSum)`
- 정규화된 가중치 합산으로 0~100 사이 점수
- 점수 내림차순 정렬, rank = index + 1

### 최우선 대안
- `getBestAlternative()`: 정렬된 목록의 첫 번째 항목 반환

## 클래스 설계

```typescript
class DecisionSupportSystemAI {
  registerCriterion(id, name, weight): void
  registerAlternative(id, name, scores: Record<string, number>): void
  evaluateAlternatives(grade): AlternativeResult[]
  getBestAlternative(grade): AlternativeResult
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: evaluateAlternatives, getBestAlternative 차단
- 감사 로그: criterion.register, alternative.register, evaluate
