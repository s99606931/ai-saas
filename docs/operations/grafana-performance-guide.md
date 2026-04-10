# Grafana 대시보드 성능 최적화 가이드

> Design Ref: MTU-N90 Design §2
> Plan SC: FR-N90.6
> 작성일: 2026-04-10 | 작성자: PM Lead

---

## 1. 개요

이 가이드는 공공기관 SaaS 플랫폼의 Grafana 대시보드 성능을 최적화하는 방법을 설명합니다.
WSL2 + k3s 환경에서 24개 이상의 대시보드를 효율적으로 운영하기 위한 전략입니다.

---

## 2. Recording Rules 활용

### 2.1 원칙

자주 사용되는 복합 PromQL 쿼리는 Recording Rule로 사전 계산합니다.

| 구분 | 설명 |
|------|------|
| 대상 | 대시보드에서 3회 이상 사용되는 동일 쿼리 |
| 간격 | 30초 (대시보드 갱신 주기와 동기화) |
| 명명 | `{범위}:{메트릭}:{계산방법}` (예: `cluster:cpu_usage:ratio`) |

### 2.2 사전 계산 목록

| Recording Rule | 원본 쿼리 | 응답 시간 개선 |
|---------------|----------|--------------|
| `cluster:cpu_usage:ratio` | `1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))` | 10배 |
| `cluster:memory_usage:ratio` | `1 - sum(available)/sum(total)` | 8배 |
| `namespace:cpu_usage:sum_rate5m` | `sum by (namespace)(rate(...))` | 5배 |
| `service:availability:ratio24h` | 24시간 에러율 계산 | 20배 |

### 2.3 적용 방법

```bash
# Recording Rules 배포
kubectl apply -f infra/monitoring/grafana-optimized-recording-rules.yaml

# 확인
kubectl get prometheusrule -n monitoring grafana-optimized-recording-rules
```

---

## 3. 쿼리 최적화 패턴

### 3.1 변수 쿼리 최적화

```
# 비효율적 (전체 메트릭 스캔)
label_values(up, namespace)

# 효율적 (kube-state-metrics 활용)
label_values(kube_namespace_created, namespace)
```

### 3.2 범위 제한

```
# 비효율적 (기본 6시간 범위)
rate(http_requests_total[5m])

# 효율적 (변수로 범위 제한)
rate(http_requests_total[$__rate_interval])
```

### 3.3 즉시 쿼리 활용

테이블/Stat 패널에서는 range 쿼리 대신 instant 쿼리를 사용합니다.

```json
{
  "targets": [{
    "expr": "cluster:cpu_usage:ratio",
    "instant": true,
    "format": "table"
  }]
}
```

---

## 4. Grafana 서버 튜닝

### 4.1 주요 설정값

| 설정 | 값 | 설명 |
|------|-----|------|
| `dataproxy.max_conns_per_host` | 10 | 데이터소스당 최대 동시 연결 |
| `dataproxy.timeout` | 30초 | 쿼리 타임아웃 |
| `dashboards.min_refresh_interval` | 5초 | 최소 갱신 주기 |
| `concurrent_render_request_limit` | 10 | 동시 렌더링 제한 |

### 4.2 대시보드 설계 규칙

1. **패널 수 제한**: 대시보드당 최대 15개 패널
2. **기본 시간 범위**: 1시간 (과거 7일 이상 조회 시 VictoriaMetrics 데이터소스 사용)
3. **갱신 주기**: 최소 5초, 권장 30초
4. **변수 쿼리**: `label_values()` 대신 Recording Rule 또는 kube-state-metrics 활용
5. **데이터소스 분리**: 최근 30일 → Prometheus, 장기 → VictoriaMetrics

---

## 5. 모니터링 대시보드 목록

| 대시보드 | 패널 수 | 갱신 주기 | Recording Rules 사용 |
|---------|--------|----------|-------------------|
| 클러스터 개요 (최적화) | 9 | 30초 | 전체 |
| SLO 개요 | 6 | 60초 | 부분 |
| 서비스 RED 메트릭 | 8 | 15초 | 부분 |
| 보안 이벤트 | 5 | 30초 | 미적용 |

---

## 6. 트러블슈팅

### 6.1 대시보드 로드 느림

```bash
# Prometheus 쿼리 로그 확인
kubectl logs -n monitoring prometheus-kube-prometheus-stack-prometheus-0 \
  --tail=100 | grep "slow query"

# Grafana 쿼리 시간 확인
# Grafana UI → Inspect → Query → 응답 시간 확인
```

### 6.2 Recording Rule 미적용

```bash
# PrometheusRule 상태 확인
kubectl describe prometheusrule -n monitoring grafana-optimized-recording-rules

# Prometheus UI에서 Recording Rule 확인
# http://localhost:30090/rules
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
