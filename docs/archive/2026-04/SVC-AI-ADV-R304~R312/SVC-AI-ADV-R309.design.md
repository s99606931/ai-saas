# SVC-AI-ADV-R309 Design: AI기반 코드 복잡도 자동 감소

## 핵심 알고리즘

### 복잡도 점수 계산
- complexityScore = min(100, cyclomaticComplexity * 10)
- depthScore = min(100, nestingDepth * 20)
- paramScore = min(100, paramCount * 15)
- total = complexityScore*0.5 + depthScore*0.3 + paramScore*0.2

### 리팩토링 제안
- cyclomaticComplexity > 10: "함수 분리 검토"
- nestingDepth > 4: "Early return 패턴 적용 검토"
- paramCount > 5: "파라미터 객체 패턴 적용 검토"
- lines > 80: "단일 책임 원칙 위반 — 함수 분리 필요"

## 인터페이스 설계

```typescript
class CodeComplexityReducerAI {
  registerFunction(id, fileName, functionName, lines): void
  recordComplexity(funcId, cyclomaticComplexity, nestingDepth, paramCount, grade?): void
  calculateComplexityScore(funcId): ComplexityResult
  getRefactoringSuggestions(funcId): string[]
  getAuditLog(): AuditEntry[]
}
```
