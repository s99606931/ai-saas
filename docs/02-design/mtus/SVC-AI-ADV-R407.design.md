# SVC-AI-ADV-R407 Design: AI기반 공공기관 계약 위험 분석

## 핵심 알고리즘

### 위험 점수 계산
- RISK_SCORE: { critical: 30, high: 20, medium: 10, low: 5 }
- `riskScore = sum(RISK_SCORE[clause.severity])`
- 고위험: riskScore >= 50

## 클래스 설계

```typescript
class ContractRiskAnalyzerAI {
  registerContract(id, title, contractType): void
  recordRiskClause(contractId, clauseType, severity, grade): void
  getRiskScore(contractId): RiskScoreResult
  getHighRiskContracts(threshold): RiskScoreResult[]
  getAuditLog(): AuditEntry[]
}
```
