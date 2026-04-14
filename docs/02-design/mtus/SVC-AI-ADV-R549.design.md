# SVC-AI-ADV-R549 Design — public-data-open-index-v2.ts
Plan Ref: SVC-AI-ADV-R549.plan.md
## 클래스 설계
```typescript
class PublicDataOpenIndexV2 {
  registerDataset(datasetId, name, agency, totalRecords): Dataset
  recordOpenData(datasetId, openRecords, formats[], dataGrade?): void
  getOpenIndex(datasetId): number  // openRecords/totalRecords*100
  getLowOpenDatasets(): Dataset[]  // openIndex < 50
  getAuditLog(): AuditEntry[]
}
```
