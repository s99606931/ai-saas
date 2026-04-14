# SVC-AI-ADV-R499 Design — data-governance-dashboard-v2.ts

Plan Ref: SVC-AI-ADV-R499.plan.md

## 클래스 설계

```typescript
type IssueSeverity = 'high' | 'medium' | 'low'

class DataGovernanceDashboardV2 {
  registerAsset(assetId, name, owner, dataGrade): DataAsset
  recordIssue(assetId, issueType, severity, dataGrade?): void
  getIssueCount(assetId): number
  getHighRiskAssets(): DataAsset[]  // severity=high 이슈 1개 이상
  getAuditLog(): AuditEntry[]
}
```

## 고위험 자산
해당 assetId에 severity='high' 이슈가 1개 이상인 자산
