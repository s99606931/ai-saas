# MTU-N135: 용량 예측 자동화 — Design

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | docs/01-plan/mtus/MTU-N135.plan.md |
| 아키텍처 선택 | Pragmatic Balance — Prometheus predict_linear + 보고서 |
| 핵심 결정 | 선형 회귀 기반 14일/30일 예측, 3개 리소스 유형 |

## 1. 예측 모델

### 1.1 Prometheus predict_linear 활용

```promql
# 14일 후 CPU 예측
predict_linear(
  node_cpu_seconds_total{mode="idle"}[7d],
  14 * 24 * 3600
)

# 30일 후 디스크 예측
predict_linear(
  node_filesystem_avail_bytes[7d],
  30 * 24 * 3600
)
```

### 1.2 고갈 예측 기준

| 리소스 | 경고 기준 | 위험 기준 |
|--------|----------|----------|
| CPU | 14일 후 사용률 > 85% | 14일 후 사용률 > 95% |
| 메모리 | 14일 후 사용률 > 80% | 14일 후 사용률 > 90% |
| 디스크 | 30일 후 여유 < 20% | 30일 후 여유 < 10% |

## 2. Recording Rules 설계

```yaml
# 3개 리소스 x 2개 예측 구간 = 6개 규칙
capacity_forecast:cpu:14d_usage_ratio
capacity_forecast:cpu:30d_usage_ratio
capacity_forecast:memory:14d_usage_ratio
capacity_forecast:memory:30d_usage_ratio
capacity_forecast:disk:14d_avail_ratio
capacity_forecast:disk:30d_avail_ratio
```

## 3. 보고서 섹션

1. 현재 용량 현황 (CPU/메모리/디스크 사용률)
2. 14일 예측 (리소스별)
3. 30일 예측 (리소스별)
4. 증설 권고 (고갈 예상 리소스 + 시점 + 규모)
5. 비용 영향 (증설 시 예상 비용)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 설계 | PM Lead |
