# SVC-AI-ADV-R495 Design — auto-data-classifier-v3.ts

Plan Ref: SVC-AI-ADV-R495.plan.md

## 클래스 설계

```typescript
type DataGradeClass = 'C' | 'S' | 'O'

class AutoDataClassifierV3 {
  registerItem(itemId, name, keywords[]): DataItem
  classifyItem(itemId, dataGrade?): DataGradeClass
  getClassification(itemId): DataGradeClass
  getItemsByGrade(grade): DataItem[]
  getAuditLog(): AuditEntry[]
}
```

## 분류 규칙
keywords에 'secret'|'password'|'주민번호'|'개인정보' 포함 → C
keywords에 'internal'|'confidential'|'기밀' 포함 → S
그 외 → O
C 규칙이 S보다 우선
