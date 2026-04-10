# MTU-N93: 예측적 스케일링 메트릭 — Design

> **Phase**: 모니터링 Round 7
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N93-predictive-scaling.plan.md` |
| 핵심 PromQL | `predict_linear()` — 선형 회귀 기반 미래 값 예측 |

---

## 1. predict_linear 원리

```
predict_linear(v range-vector, t scalar)
→ 현재부터 t초 후 예측 값 반환 (선형 회귀)

예: predict_linear(node_filesystem_avail_bytes[24h], 86400)
→ 24시간 추세로 24시간 후 남은 디스크 용량 예측
```

---

## 2. 상세 설계

### 2.1 디스크 용량 소진 예측 (FR-N93.1)

```yaml
- alert: DiskWillFillIn24h
  expr: |
    predict_linear(
      node_filesystem_avail_bytes{mountpoint="/"}[24h], 86400
    ) < 0
  for: 30m

- alert: DiskWillFillIn4h
  expr: |
    predict_linear(
      node_filesystem_avail_bytes{mountpoint="/"}[6h], 14400
    ) < 0
  for: 15m
  labels:
    severity: critical
```

### 2.2 메모리 트렌드 예측 (FR-N93.2)

```yaml
- alert: MemoryWillExhaustIn24h
  expr: |
    predict_linear(
      node_memory_MemAvailable_bytes[24h], 86400
    ) < node_memory_MemTotal_bytes * 0.05
  for: 30m
```

### 2.3 PV 용량 예측 (FR-N93.6)

```yaml
- alert: PVWillFillIn48h
  expr: |
    predict_linear(
      kubelet_volume_stats_available_bytes[48h], 172800
    ) < 0
  for: 1h
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
