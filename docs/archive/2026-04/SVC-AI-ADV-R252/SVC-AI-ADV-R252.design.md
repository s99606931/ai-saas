# SVC-AI-ADV-R252 — 설비 예측 유지보수 AI Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
PredictiveMaintenanceAI
├── registerEquipment(equipment)
├── recordSensor(equipmentId, metric, value, timestamp)
├── detectAnomalies(equipmentId): AnomalyEvent[]
├── predictFailureProbability(equipmentId): FailurePrediction
├── recommendMaintenance(equipmentId): MaintenanceRecommendation
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **이상 탐지**: 임계값 초과 횟수 + 평균 편차율 (>20% → 이상)
- **고장 확률**: 이상 이벤트 수 × 가중치 / 24h 윈도우
- **정비 우선순위**: 확률 ≥ 0.8 → IMMEDIATE, ≥ 0.5 → 1주, ≥ 0.2 → 1개월, else → 정기

## CSAP D-09 준수

- 센서 데이터 등록·예측 감사 로그
- N2SF C/S 차단
