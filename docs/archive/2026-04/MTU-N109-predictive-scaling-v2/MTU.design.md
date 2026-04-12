# MTU-N109: ML 기반 예측 스케일링 고도화 — Design

> **MTU ID**: MTU-N109 | **작성일**: 2026-04-10

---

## 아키텍처: Pragmatic Balance

```
Prometheus -> Feature Store -> XGBoost + Prophet 앙상블
    |                                     |
    v                               예측 결과 (15분, 1시간, 24시간)
 시계열 DB                                |
                                    Custom Metrics Adapter
                                          |
                                    HPA (Predictive)
```

### DS-N109.1: XGBoost 다변량 특성 벡터

입력 특성:
- CPU/Memory/Network 사용률 (과거 24시간)
- 시간대 (hour_of_day, day_of_week)
- 일간/주간 패턴 분해 (STL)
- 이동 평균 (5분, 15분, 1시간)
- 최근 스파이크 횟수

### DS-N109.2: Prophet 앙상블 전략

1. Prophet: 계절성 + 추세 + 휴일 효과 예측
2. XGBoost: 다변량 비선형 관계 예측
3. 앙상블: 가중 평균 (Prophet 40% + XGBoost 60%)
4. 결과: 15분 후 / 1시간 후 / 24시간 후 예측

### DS-N109.3: HPA Custom Metrics

```yaml
metrics:
  - type: External
    external:
      metric:
        name: predicted_cpu_15m
      target:
        type: Value
        value: "70"  # 예측 CPU 70% 초과 시 확장
```

## Design Anchor

- Plan SC: FR-N109.1~FR-N109.5 전수 반영
- 기존 N93 기초 예측과 병렬 운영
