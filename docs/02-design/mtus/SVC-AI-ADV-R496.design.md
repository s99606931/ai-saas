# SVC-AI-ADV-R496 Design — operations-manual-generator-v2.ts

Plan Ref: SVC-AI-ADV-R496.plan.md

## 클래스 설계

```typescript
class OperationsManualGeneratorV2 {
  addSection(sectionId, title, content, category): ManualSection
  updateSection(sectionId, newContent, dataGrade?): void
  getTableOfContents(): { sectionId, title, category }[]
  getSectionsByCategory(category): ManualSection[]
  getAuditLog(): AuditEntry[]
}
```

## 목차 형식
`getTableOfContents()` → 등록 순서대로 sectionId, title, category 반환
