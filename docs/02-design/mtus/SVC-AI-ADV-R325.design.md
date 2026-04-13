# SVC-AI-ADV-R325 Design: AI기반 비즈니스 규칙 자동 추출

## 핵심 알고리즘

### 규칙 구조
- BusinessRule: { id, condition, action }
- condition: 평가 함수 (context 기반)
- action: 조건 충족 시 적용 액션

### 규칙 실행
- context 전달 → condition(context) === true인 규칙 목록 반환
- 매칭된 규칙의 action 목록 반환

### 충돌 탐지
- 동일 condition key, 다른 action → conflict

## 인터페이스 설계

```typescript
class BusinessRuleExtractorAI {
  registerRule(id, name, conditionKey, conditionValue, action, grade?): void
  evaluate(context: Record<string, unknown>): RuleEvaluationResult[]
  detectConflicts(): ConflictReport[]
  getAuditLog(): AuditEntry[]
}

interface RuleEvaluationResult {
  ruleId: string
  ruleName: string
  matched: boolean
  action: string
}

interface ConflictReport {
  conditionKey: string
  conditionValue: unknown
  conflictingActions: string[]
}
```
