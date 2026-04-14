# SVC-AI-ADV-R497 Design — public-institution-risk-scorer-v2.ts

Plan Ref: SVC-AI-ADV-R497.plan.md

## 클래스 설계

```typescript
type RiskLevel = 'high' | 'medium' | 'low'

class PublicInstitutionRiskScorerV2 {
  registerInstitution(institutionId, name, type): Institution
  recordRiskFactor(institutionId, riskFactor, score, dataGrade?): void
  getRiskScore(institutionId): number   // min(100, sum of all scores)
  getRiskLevel(institutionId): RiskLevel // >=70:high, >=40:medium, else low
  getHighRiskInstitutions(): Institution[]
  getAuditLog(): AuditEntry[]
}
```

## 위험 등급
>=70: high, >=40: medium, else low
