# SVC-AI-ADV-R311 Design: AI기반 공공기관 의사결정 지원

## 핵심 알고리즘

### 가중 합산 점수 (WAS)
- 기준별 가중치 정규화: weight / sum(weights)
- 대안 점수 = sum(criterionScore * normalizedWeight)
- 점수 내림차순 순위화

### 최적 대안 추천
- 1위 대안 = 최적 추천

## 인터페이스 설계

```typescript
class DecisionSupportAI {
  registerDecision(id, title, criteria: Array<{id, name, weight}>): void
  addAlternative(decisionId, altId, altName, scores: Record<criterionId, number>): void
  rankAlternatives(decisionId): RankedAlternative[]
  getBestAlternative(decisionId): RankedAlternative
  getAuditLog(): AuditEntry[]
}

interface RankedAlternative {
  altId: string
  altName: string
  totalScore: number
  rank: number
}
```
