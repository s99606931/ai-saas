# SVC-AI-ADV-R471 Design — code-test-auto-generator-v3.ts

Plan Ref: SVC-AI-ADV-R471.plan.md

## 클래스 설계

```typescript
type TestCaseType = 'happy' | 'edge' | 'error'
type Complexity = 'low' | 'medium' | 'high'

class CodeTestAutoGeneratorV3 {
  registerFunction(funcId, name, complexity): TestableFunction
  addTestCase(funcId, caseType, dataGrade?): void
  getCoverageRate(funcId): number   // unique caseTypes / 3 * 100
  getUncoveredFunctions(): TestableFunction[]  // coverageRate < 100
  getAuditLog(): AuditEntry[]
}
```

## 커버리지 공식
`coverageRate = new Set(testCases.filter(t => t.funcId===funcId).map(t=>t.caseType)).size / 3 * 100`
