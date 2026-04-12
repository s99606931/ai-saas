# SVC-AI-ADV-R183 Design — AI 기반 장애 예측 엔진 v2

> 작성일: 2026-04-12 | 버전: 1.0.0

## 클래스 설계

```
FailurePredictionEngineV2
  ├── metrics: Map<string, MetricDefinition>
  ├── readings: Map<string, MetricReading[]>
  ├── windowSize: number
  ├── auditLog: FPEAuditEntry[]
  ├── registerMetric(def) → void
  ├── recordReading(reading) → void
  ├── predict() → PredictionReport
  └── getAuditLog() → readonly FPEAuditEntry[]
```

## 핵심 알고리즘

- 슬라이딩 윈도우: 최근 windowSize개 readings 사용
- 이상 탐지: z-score = (value - mean) / stddev
- 예측 점수: 이상 메트릭 수 / 전체 메트릭 수
- 경보 레벨: score≥0.7→critical, ≥0.4→warning, else→normal

## 보안 설계

- DataGrade C/S 차단 (N2SF N-05)
- 감사 로그 append-only
