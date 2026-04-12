# MTU Design — SVC-AI-ADV-R153 Multi-Turn Memory Compactor

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R153.plan.md

## 아키텍처: Sliding + Summarization Compactor

```
appendTurn(role, content, opts) → turns.push({role, content, tokens, pinned})
compactIfNeeded(budget):
  if total <= budget → return
  tail = last 2 non-pinned + all pinned (recent window)
  head = 나머지 (압축 대상 일반 턴)
  if head.length >= 2:
     summaryContent = `[SUMMARY: ${head.length} turns, topics=${topics}]`
     replace head with single summary turn (role='system')
  while total > budget:
     가장 오래된 non-pinned non-summary 턴 제거
```

## 토큰 추정

```
estimateTokens(text) = text.trim().split(/\s+/).length  // tokens 제공 시 우선
```

## 타입

```ts
export type Role = 'system' | 'user' | 'assistant'
export type DataGrade = 'O' | 'C' | 'S'

export interface Turn {
  role: Role
  content: string
  tokens: number
  pinned: boolean
  summary?: boolean
}

export interface AppendOpts {
  pinned?: boolean
  tokens?: number
  grade?: DataGrade
}
```

## API

```ts
class MultiTurnMemoryCompactor {
  appendTurn(role: Role, content: string, opts?: AppendOpts): void
  totalTokens(): number
  compactIfNeeded(budget: number): { compacted: boolean; before: number; after: number }
  getCompactedHistory(): Turn[]
  reset(): void
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 빈 content → `invalid_input`
- budget <= 0 → `invalid_budget`
- C/S 등급 → `grade_blocked`
