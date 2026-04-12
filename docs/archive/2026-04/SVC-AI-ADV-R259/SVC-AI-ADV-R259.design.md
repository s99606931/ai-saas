# SVC-AI-ADV-R259 — 인프라 비용 자동 예측 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
InfraCostForecasterAI
├── registerResource(id, name, unitCost, monthlyBudget)
├── recordUsage(resourceId, amount, date, grade)
├── forecast(resourceId, forecastDays): ForecastResult
│   └── 선형 회귀: slope = Σ(xi-x̄)(yi-ȳ) / Σ(xi-x̄)²
├── getBudgetAlerts(): BudgetAlert[]
│   └── forecastedCost > monthlyBudget → alert
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **선형 회귀**: 일별 사용량 시계열 → slope + intercept 계산
- **예측**: predicted = intercept + slope * (n + forecastDays)
- **예산 경고**: 월간 예측 비용 > 예산 → critical/warning 분류

## CSAP D-12 준수

- 입력 검증: amount > 0, forecastDays > 0
- N2SF C/S 등급 차단, 감사 로그
