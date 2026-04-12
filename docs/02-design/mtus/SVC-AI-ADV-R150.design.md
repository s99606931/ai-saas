# MTU Design — SVC-AI-ADV-R150 Sentiment-Based Router

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R150.plan.md

## 아키텍처: Weighted Keyword Routing

```
text → toLowerCase → negative hit scan → urgency hit scan
    → score = max(negativeScore, urgencyScore) with 교집합 가중 (min(1, neg+urg*0.7))
    → queue = HIGH | NORMAL | LOW
```

최종 공식:
```
score = min(1, max(neg, urg) + min(neg, urg) * 0.5)
```
단독 강한 신호(긴급/부정 하나만 높아도 반영) + 두 신호 동반 시 가산.

## 키워드 사전 (기본)

### 부정 (weight)
- 불만(0.3), 억울(0.4), 화가(0.4), 분노(0.5), 실망(0.3)
- 최악(0.5), 너무하(0.3), 불쾌(0.3)
- 영어: angry(0.4), terrible(0.4), awful(0.4), disappointed(0.3)

### 긴급 (weight)
- 긴급(0.6), 당장(0.4), 즉시(0.4), 응급(0.7), 생명(0.8), 위험(0.5), 위독(0.8)
- 영어: urgent(0.6), emergency(0.7), immediately(0.4), critical(0.6)

## 타입

```ts
export type RouteQueue = 'HIGH' | 'NORMAL' | 'LOW'

export interface KeywordHit { term: string; weight: number }

export interface RouteDecision {
  queue: RouteQueue
  score: number
  negativeScore: number
  urgencyScore: number
  negativeHits: KeywordHit[]
  urgencyHits: KeywordHit[]
}
```

## API

```ts
class SentimentBasedRouter {
  route(text: string, grade?: DataGrade): RouteDecision
  addNegativeKeyword(term: string, weight: number): void
  addUrgencyKeyword(term: string, weight: number): void
  getAuditLog(): AuditEntry[]
}
```

## 결정 규칙

- HIGH: score >= 0.7
- NORMAL: 0.3 <= score < 0.7
- LOW: score < 0.3
- 개별 카테고리는 단일 키워드 가중치 합 → min(합, 1) 정규화

## 예외

- 빈 text: `invalid_input`
- 빈 term / 0 이하 weight: `invalid_keyword`
- C/S등급: `grade_blocked`
