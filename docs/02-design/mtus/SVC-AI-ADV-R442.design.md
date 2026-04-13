# SVC-AI-ADV-R442 Design — code-architecture-validator-ai.ts

Plan Ref: SVC-AI-ADV-R442.plan.md

## 클래스 설계

```typescript
type ViolationType = 'circular' | 'layerSkip' | 'god-class'

class CodeArchitectureValidatorAI {
  registerComponent(componentId, name, layer): Component
  recordViolation(componentId, violationType, dataGrade?): void
  getViolationScore(componentId): number
  getHighRiskComponents(threshold): Component[]
  getAuditLog(): AuditEntry[]
}
```

## VIOLATION_SCORE 매핑
| type | score |
|------|-------|
| circular | 30 |
| layerSkip | 20 |
| god-class | 15 |

누적 합산 방식
