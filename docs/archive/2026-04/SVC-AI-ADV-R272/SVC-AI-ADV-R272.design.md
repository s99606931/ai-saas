# SVC-AI-ADV-R272 — 설계

## 구조

```
setBudget(agencyId, account, limit)
recordExecution({agencyId, account, amount, supplierId, date})
detectAnomalies() → Anomaly[]
  - STATISTICAL: mean ± 2*stddev 밖
  - DUPLICATE: 동일 supplier + 동일 금액 7일 이내
  - OVER_BUDGET: 계정과목 합계 > limit
```
