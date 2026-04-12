# SVC-AI-ADV-R222 — AI 기반 서비스 비용 이상 탐지 v2 Design

> 작성일: 2026-04-12 | 버전: 1.0.0

## 컴포넌트 설계

```
ServiceCostAnomalyDetectorV2
├── registerService(id, name, budgetLimit, expectedDailyCost)
├── recordCost(serviceId, amount, date, grade)
├── detectAnomalies(serviceId): AnomalyResult[]
│   ├── Z-스코어 > 2.0 → anomaly
│   └── amount > budgetLimit → budget_exceeded
├── getRecommendations(serviceId): CostRecommendation[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **Z-스코어**: `(amount - mean) / stddev`, 임계값 2.0
- **예산 초과**: amount > budgetLimit → 즉시 알림
- **권고**: 3일 연속 초과 → 리소스 스케일다운 권고

## CSAP D-12 준수

- 입력 검증: amount > 0, 날짜 형식 확인
- N2SF C/S 등급 차단, 감사 로그
