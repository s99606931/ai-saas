# SVC-AI-ADV-R469 Design — public-data-lifecycle-manager-v2.ts

Plan Ref: SVC-AI-ADV-R469.plan.md

## 클래스 설계

```typescript
class PublicDataLifecycleManagerV2 {
  registerData(dataId, name, category, retentionYears, createdAt?: Date): DataRecord
  getExpiredData(currentDate?: Date): DataRecord[]
  disposeData(dataId, dataGrade?): void
  getActiveData(): DataRecord[]
  getAuditLog(): AuditEntry[]
}

interface DataRecord {
  dataId: string
  name: string
  category: string
  retentionYears: number
  createdAt: Date
  disposed: boolean
}
```

## 만료 조건
`createdAt + retentionYears * 365 * 24 * 60 * 60 * 1000 < currentDate`
