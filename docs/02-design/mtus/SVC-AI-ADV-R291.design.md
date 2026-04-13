# SVC-AI-ADV-R291 Design: AI기반 공공기관 리스크 스코어링

## 핵심 알고리즘

### 종합 리스크 점수 계산
- 입력: vulnerabilities(취약점 수), obsolescenceRate(%), complianceRate(%)
- vulnerabilityScore = min(100, vulnerabilities * 10)
- obsolescenceScore = obsolescenceRate (0~100)
- complianceScore = 100 - complianceRate (미준수율)
- totalRisk = vulnerabilityScore*0.4 + obsolescenceScore*0.3 + complianceScore*0.3

### 리스크 등급
- totalRisk >= 75: F, >= 60: D, >= 45: C, >= 30: B, else: A

## 인터페이스 설계

```typescript
class PublicInstitutionRiskScorer {
  registerInstitution(id, name, scale, type): void
  recordRiskMetrics(institutionId, vulnerabilities, obsolescenceRate, complianceRate, grade?): void
  calculateRiskScore(institutionId): RiskScoreResult
  getHighRiskInstitutions(threshold?): RiskScoreResult[]
  getAuditLog(): AuditEntry[]
}
```
