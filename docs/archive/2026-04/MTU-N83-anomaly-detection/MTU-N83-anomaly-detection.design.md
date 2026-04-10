# MTU-N83: 이상 탐지 ML 모델 — Design

> **MTU ID**: MTU-N83
> **Plan 참조**: docs/01-plan/mtus/MTU-N83-anomaly-detection.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| ML 엔진 | Prophet (Facebook/Meta) — 시계열 예측 |
| 대안 | Prometheus 내장 predict_linear() + 통계 기반 z-score |
| 실행 방식 | K8s CronJob (30분 주기) |
| 데이터 소스 | Prometheus PromQL API |

## 아키텍처

```
┌─ CronJob: anomaly-detector (30분 주기) ──┐
│                                          │
│  1. Prometheus API로 메트릭 조회           │
│     - CPU/Memory 사용률                   │
│     - 요청 레이턴시 (p95/p99)             │
│     - 에러율 (5xx)                       │
│     - 비용 메트릭 (OpenCost)              │
│                                          │
│  2. 통계 기반 이상 탐지                    │
│     - Z-Score (3 시그마 규칙)             │
│     - 이동 평균 편차                       │
│     - 시계열 분해 (계절성 제거)            │
│                                          │
│  3. 결과 → Prometheus Pushgateway         │
│     - anomaly_score 메트릭               │
│     - anomaly_detected 메트릭            │
│                                          │
│  4. AlertManager → 알림                   │
└──────────────────────────────────────────┘
```

## 이상 탐지 알고리즘

| 방법 | 용도 | 설명 |
|------|------|------|
| Z-Score | 포인트 이상치 | 평균에서 3 시그마 이상 벗어난 값 |
| 이동평균 편차 | 추세 변화 | 1시간 vs 24시간 이동평균 비교 |
| predict_linear | 사전 경고 | 선형 추세로 임계값 도달 시간 예측 |
| 계절성 분해 | 패턴 기반 | 주기적 패턴(일/주) 대비 이상 여부 |

## 비용 이상 탐지

| 메트릭 | 알림 조건 | 설명 |
|--------|----------|------|
| 일일 비용 | 전일 대비 50%+ 증가 | 리소스 과다 사용 |
| 주간 비용 | 전주 대비 30%+ 증가 | 트렌드 변화 |
| 네임스페이스 비용 | 예산 80% 초과 | 예산 소진 경고 |
