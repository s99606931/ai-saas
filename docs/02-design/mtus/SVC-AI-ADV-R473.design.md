# SVC-AI-ADV-R473 Design — privacy-compliance-automator-v2.ts

Plan Ref: SVC-AI-ADV-R473.plan.md

## 클래스 설계

```typescript
class PrivacyComplianceAutomatorV2 {
  registerItem(itemId, dataType, purpose, retentionDays, consentRequired): PrivacyItem
  recordConsent(itemId, consentGiven, dataGrade?): void
  getComplianceRate(): number
  getNonConsentItems(): PrivacyItem[]
  getAuditLog(): AuditEntry[]
}
```

## 준수율 공식
consentRequired=true 항목 중 최신 기록이 consentGiven=true인 비율 * 100
consentRequired 항목 없으면 100
