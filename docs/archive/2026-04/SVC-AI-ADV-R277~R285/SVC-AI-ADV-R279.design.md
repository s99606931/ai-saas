# SVC-AI-ADV-R279 Design: AI기반 실시간 보안 정책 시행

## 핵심 알고리즘

### 정책 평가 엔진
- 정책: id, name, conditions(Map<string,unknown>), action('block'|'warn'|'allow'), priority
- 우선순위 내림차순 정렬 후 첫 번째 매칭 정책 적용
- 조건 매칭: 요청의 속성이 정책 조건과 일치하는지 확인

### 위반 기록
- action이 'block' 또는 'warn'인 경우 위반 이력 저장
- 정책별/전체 위반 이력 조회

## 인터페이스 설계

```typescript
class RealtimeSecurityPolicyEnforcer {
  registerPolicy(id, name, conditions, action, priority): void
  evaluate(request: Record<string,unknown>): EvaluationResult
  getViolationHistory(policyId?): ViolationRecord[]
  getAuditLog(): AuditEntry[]
}

interface EvaluationResult {
  matched: boolean
  policyId: string | null
  action: 'block' | 'warn' | 'allow' | 'none'
  reason: string
}
```
