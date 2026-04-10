# MTU-N96: 멀티테넌트 모니터링 격리 — Design

> **Phase**: 모니터링 Round 7
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## 1. 격리 모델

```
Namespace = Tenant
├── tenant-a-ns/
│   ├── Pod metrics (CPU, Memory)
│   ├── Service metrics (RED)
│   └── SLO metrics (가용성, 지연)
├── tenant-b-ns/
│   └── ...
└── monitoring/
    └── Prometheus (전체 수집 + 레이블 기반 필터링)
```

---

## 2. 상세 설계

### 2.1 테넌트별 Recording Rules

```yaml
- record: tenant:cpu_usage:sum
  expr: sum by (namespace) (rate(container_cpu_usage_seconds_total{container!=""}[5m]))
  labels:
    aggregation: tenant

- record: tenant:memory_usage:sum
  expr: sum by (namespace) (container_memory_working_set_bytes{container!=""})
  labels:
    aggregation: tenant

- record: tenant:request_rate:sum
  expr: sum by (namespace) (rate(http_requests_total[5m]))
  labels:
    aggregation: tenant
```

### 2.2 테넌트별 SLO

```yaml
- record: tenant:availability:ratio5m
  expr: |
    1 - (
      sum by (namespace) (rate(http_requests_total{code=~"5.."}[5m]))
      / clamp_min(sum by (namespace) (rate(http_requests_total[5m])), 0.001)
    )
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
