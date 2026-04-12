# SVC-AI-ADV-R262 — API 사용량 예측 v2 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
ApiUsageForecasterAI
├── registerApi(id, path, maxCapacity, warningThresholdPercent)
├── recordCallCount(apiId, count, hour, grade)
├── forecastUsage(apiId, forecastHours): UsageForecast
│   └── 이동 평균 + 선형 추세 결합
├── getCapacityAlerts(): CapacityAlert[]
│   └── forecastedPeak > maxCapacity * warningThreshold → alert
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **이동 평균**: 최근 N시간 평균으로 기준선
- **추세**: 최근 데이터 선형 회귀 slope
- **예측**: baseline + slope * forecastHours

## CSAP D-12 준수

- 예측 결과 감사 로그
- N2SF C/S 등급 차단
