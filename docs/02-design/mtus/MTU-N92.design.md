# MTU-N92: AI 기반 이상 탐지 (Adaptive Alerting) — Design

> **Phase**: 모니터링 Round 7 — 심화 최적화
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N92-anomaly-detection-adaptive.plan.md` |
| 참조 자료 | Grafana PromQL Anomaly Detection, Prometheus Z-Score 기법 |

---

## 1. 이상 탐지 원리

```
                      3 sigma
    ────────────────────┬──────────────────── 이상 (anomaly)
                        │
                        │  2 sigma
    ──────────────┬─────┼─────┬────────────── 경고 (warning)
                  │     │     │
    평균 ─────────┼─────┼─────┼───────────── 정상 범위
                  │     │     │
    ──────────────┴─────┼─────┴──────────────
                        │
    ────────────────────┴────────────────────

    Z-Score = (현재값 - 이동평균) / 표준편차
    |Z| > 3 → critical (99.7% 벗어남)
    |Z| > 2 → warning  (95.4% 벗어남)
```

---

## 2. 상세 설계

### 2.1 적응형 임계값 Recording Rules (FR-N92.4)

1시간 이동 평균/표준편차를 사전 계산:

```yaml
groups:
  - name: anomaly:adaptive_thresholds
    interval: 30s
    rules:
      # 서비스별 요청률 이동 평균 (1시간)
      - record: service:http_requests:avg1h
        expr: avg_over_time(service:http_requests:rate5m[1h])

      # 서비스별 요청률 표준편차 (1시간)
      - record: service:http_requests:stddev1h
        expr: stddev_over_time(service:http_requests:rate5m[1h])

      # 서비스별 지연 이동 평균 (1시간)
      - record: service:latency_p99:avg1h
        expr: avg_over_time(service:latency_p99:seconds[1h])

      # 서비스별 지연 표준편차 (1시간)
      - record: service:latency_p99:stddev1h
        expr: stddev_over_time(service:latency_p99:seconds[1h])
```

### 2.2 Z-Score 기반 알림 규칙

```yaml
groups:
  - name: anomaly:z_score_alerts
    rules:
      # 요청률 이상 탐지 (FR-N92.1)
      - alert: AnomalyHighRequestRate
        expr: |
          (service:http_requests:rate5m - service:http_requests:avg1h)
          / clamp_min(service:http_requests:stddev1h, 0.001)
          > 3
        for: 5m
        labels:
          severity: warning
          detection: z-score
        annotations:
          summary: "서비스 {{ $labels.service }} 요청률 이상 탐지"
          description: "Z-Score {{ $value | printf \"%.2f\" }} (3 sigma 초과)"

      # 응답 지연 이상 탐지 (FR-N92.2)
      - alert: AnomalyHighLatency
        expr: |
          (service:latency_p99:seconds - service:latency_p99:avg1h)
          / clamp_min(service:latency_p99:stddev1h, 0.0001)
          > 3
        for: 5m
        labels:
          severity: warning
          detection: z-score
```

### 2.3 이상 탐지 대시보드 (FR-N92.5)

- Z-Score 시계열 그래프 (서비스별)
- 이동 평균 + 2/3 sigma 밴드 오버레이
- 이상 감지 이벤트 타임라인

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
