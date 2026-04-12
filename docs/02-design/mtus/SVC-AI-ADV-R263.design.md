# SVC-AI-ADV-R263 Design — 규정 의사결정 엔진

> 2026-04-13

## Design Anchor
- Plan: SVC-AI-ADV-R263.plan.md
- Impl: `regulation-decision-engine.ts`

## 타입

```typescript
type Op = 'EQ'|'NEQ'|'GT'|'LT'|'GTE'|'LTE'|'IN'|'CONTAINS'
type Effect = 'APPROVE'|'DENY'|'REVIEW'

interface Condition { field, op, value }
interface Rule { ruleId, title, category, conditions[], effect, priority, source }
interface Decision { decision, appliedRules[], rationale[], conflicts[] }
```

## 평가 알고리즘

```
1. 모든 rule 순회
2. conditions 모두 만족 → matched에 추가
3. matched 중 priority desc 정렬
4. effect가 갈라지면 conflicts 기록
5. 최종 decision = 최고 priority rule의 effect (동점이면 REVIEW)
```

## 충돌 정의

- 동일 matched 목록 내 effect APPROVE + DENY 공존 → conflict
