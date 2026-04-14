# SVC-AI-ADV-R530 Design — code-complexity-analyzer-v2.ts
Plan Ref: SVC-AI-ADV-R530.plan.md
## 클래스 설계
```typescript
type ComplexityGrade = 'high' | 'medium' | 'low'
class CodeComplexityAnalyzerV2 {
  registerModule(moduleId, name, language): CodeModule
  recordMetrics(moduleId, cyclomaticComplexity, linesOfCode, dataGrade?): void
  getComplexityGrade(moduleId): ComplexityGrade  // >=20:high, >=10:medium, else low
  getHighComplexityModules(): CodeModule[]
  getAuditLog(): AuditEntry[]
}
```
## 등급 기준
>=20: high, >=10: medium, else low (cyclomaticComplexity 기준)
