# SVC-AI-ADV-R260 — 공공 서비스 만족도 예측 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
ServiceSatisfactionPredictor
├── registerService(id, name, targetScore, weights)
│   └── weights: { responseTime, errorRate, availability }
├── recordMetrics(serviceId, responseTimeMs, errorRatePercent, availabilityPercent, grade)
├── calculateScore(serviceId): SatisfactionScore
│   └── 가중치 합산: w1*(100-normalizedRT) + w2*(100-errorRate) + w3*availability
├── predictTrend(serviceId): TrendPrediction
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **응답시간 정규화**: score = max(0, 100 - responseTimeMs/10)
- **만족도 점수**: Σ(지표점수 × 가중치) / Σ(가중치)
- **트렌드**: 최근 3개 점수의 선형 방향

## CSAP D-12 준수

- N2SF C/S 등급 차단, 감사 로그
