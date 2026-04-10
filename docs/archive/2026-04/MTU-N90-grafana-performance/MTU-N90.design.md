# MTU-N90: Grafana 대시보드 성능 최적화 — Design

> **Phase**: 모니터링 Round 7 — 심화 최적화
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N90-grafana-performance.plan.md` |
| 선택 사유 | Recording Rules + 쿼리 캐싱 + 대시보드 패널 최적화 복합 전략 |

---

## 1. 아키텍처 개요

```
Recording Rules (사전 계산)
      │
      ▼
Prometheus ─── cached query ──▶ Grafana
      │                          │
      │                    ┌─────┴──────┐
      │                    │ 캐시 계층   │
      │                    │ (30초 TTL) │
      │                    └─────┬──────┘
      │                          ▼
      └── VictoriaMetrics ──▶ 장기 쿼리
```

---

## 2. 상세 설계

### 2.1 고빈도 대시보드 쿼리 Recording Rules (FR-N90.1)

기존 recording-rules.yaml에 추가할 대시보드 전용 사전 계산 규칙:

```yaml
# 대시보드 최적화용 Recording Rules
# 자주 사용되는 복합 쿼리를 사전 계산하여 대시보드 응답 시간 단축
groups:
  - name: dashboard:optimization
    interval: 30s
    rules:
      # 클러스터 전체 CPU 사용률 (overview 대시보드)
      - record: cluster:cpu_usage:ratio
        expr: 1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))

      # 클러스터 전체 메모리 사용률
      - record: cluster:memory_usage:ratio
        expr: 1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes)

      # 네임스페이스별 Pod 수
      - record: namespace:pod_count:sum
        expr: count by (namespace) (kube_pod_info)

      # 서비스별 가용성 (30일 SLO)
      - record: service:availability:ratio30d
        expr: |
          1 - (
            sum by (service) (rate(http_requests_total{code=~"5.."}[30d]))
            / sum by (service) (rate(http_requests_total[30d]))
          )

      # 노드별 디스크 사용률
      - record: node:disk_usage:ratio
        expr: |
          1 - (
            node_filesystem_avail_bytes{mountpoint="/"}
            / node_filesystem_size_bytes{mountpoint="/"}
          )
```

### 2.2 Grafana 쿼리 캐싱 (FR-N90.2)

```yaml
# grafana.ini 캐싱 설정
grafana.ini:
  dataproxy:
    max_conns_per_host: 10
    timeout: 30
    keep_alive_seconds: 30
  
  caching:
    enabled: true
    ttl: 30                        # 30초 캐시 TTL
    max_size_mb: 256               # 캐시 최대 크기
```

### 2.3 대시보드 변수 최적화 (FR-N90.3)

비효율적 변수 쿼리 패턴 → 최적화:

| Before | After |
|--------|-------|
| `label_values(up, namespace)` | `label_values(kube_namespace_created, namespace)` |
| `label_values(container_cpu_usage_seconds_total, pod)` | `label_values(kube_pod_info{namespace="$namespace"}, pod)` |

### 2.4 대시보드 패널 범위 제한 (FR-N90.4)

```json
{
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "timepicker": {
    "refresh_intervals": ["5s","10s","30s","1m","5m"],
    "time_options": ["5m","15m","1h","6h","12h","24h","7d"]
  }
}
```

### 2.5 Grafana 성능 튜닝 (FR-N90.5)

```yaml
grafana.ini:
  server:
    concurrent_render_request_limit: 10
  dataproxy:
    max_conns_per_host: 10
    timeout: 30
  rendering:
    concurrent_render_request_limit: 4
  panels:
    disable_sanitize_html: false
  dashboards:
    min_refresh_interval: 5s
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
