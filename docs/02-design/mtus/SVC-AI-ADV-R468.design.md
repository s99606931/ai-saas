# SVC-AI-ADV-R468 Design — digital-transformation-assessor-v2.ts

Plan Ref: SVC-AI-ADV-R468.plan.md

## 클래스 설계

```typescript
type DTCategory = 'process' | 'technology' | 'culture' | 'data'
type DTStage = 'leading' | 'progressing' | 'initiating' | 'lagging'

class DigitalTransformationAssessorV2 {
  registerOrg(orgId, name, type): Organization
  recordCategoryScore(orgId, category, score, dataGrade?): void
  getTransformationScore(orgId): number   // 기록된 category 평균
  getTransformationStage(orgId): DTStage
  getAuditLog(): AuditEntry[]
}
```

## 단계 기준
>=75: leading, >=50: progressing, >=25: initiating, else lagging
