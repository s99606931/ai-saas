# SVC-AI-ADV-R503 Design — public-license-intelligence-ai.ts

Plan Ref: SVC-AI-ADV-R503.plan.md

## 클래스 설계

```typescript
class PublicLicenseIntelligenceAi {
  registerLicense(licenseId, name, requiredDocuments[], processingDays): LicenseItem
  submitApplication(licenseId, applicantId, submittedDocuments[], dataGrade?): void
  getCompletionRate(licenseId): number  // submitted∩required / required.length * 100
  getMissingDocuments(licenseId): string[]
  getAuditLog(): AuditEntry[]
}
```

## 완비율 공식
`completionRate = submittedDocs.filter(d => requiredDocs.includes(d)).length / requiredDocs.length * 100`
