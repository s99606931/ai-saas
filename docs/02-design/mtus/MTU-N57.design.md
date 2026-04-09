# MTU-N57: Prometheus Recording Rules + AlertManager 라우팅 최적화 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## 1. 아키텍처 선택

**Option B: Pragmatic Balance** 선택

Recording Rules를 PrometheusRule CRD로 정의하고 AlertManager 라우팅을 kube-prometheus-stack values에 통합 관리합니다.

---

## 2. Recording Rules 설계

### 2.1 서비스 RED 메트릭 (FR-N57.1)

```yaml
# 서비스별 요청 비율 (Rate)
record: service:http_requests:rate5m
expr: sum by (service) (rate(http_requests_total[5m]))

# 서비스별 에러 비율 (Errors)  
record: service:http_errors:ratio_rate5m
expr: sum by (service) (rate(http_requests_total{code=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))

# 서비스별 P99 지연시간 (Duration)
record: service:http_request_duration:p99_5m
expr: histogram_quantile(0.99, sum by (service, le) (rate(http_request_duration_seconds_bucket[5m])))
```

### 2.2 노드 리소스 (FR-N57.2)

```yaml
# CPU 사용률
record: node:cpu_utilization:ratio
expr: 1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))

# 메모리 사용률
record: node:memory_utilization:ratio
expr: 1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)

# 디스크 사용률
record: node:disk_utilization:ratio
expr: 1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})
```

### 2.3 SLO 집계 (FR-N57.3)

```yaml
# SLO 에러 버짓 잔여율
record: slo:error_budget:remaining_ratio
expr: 1 - (slo:sli_error:ratio_rate30d / (1 - slo:objective:ratio))

# SLO 번레이트 (1시간 / 6시간)
record: slo:burn_rate:1h
expr: slo:sli_error:ratio_rate1h / (1 - slo:objective:ratio)

record: slo:burn_rate:6h
expr: slo:sli_error:ratio_rate6h / (1 - slo:objective:ratio)
```

### 2.4 k3s 클러스터 상태 (FR-N57.4)

```yaml
# Pod Ready 비율
record: cluster:pod_ready:ratio
expr: sum(kube_pod_status_ready{condition="true"}) / sum(kube_pod_status_ready)

# 네임스페이스별 리소스 사용
record: namespace:cpu_usage:sum
expr: sum by (namespace) (rate(container_cpu_usage_seconds_total[5m]))

record: namespace:memory_usage:sum_bytes
expr: sum by (namespace) (container_memory_working_set_bytes)
```

---

## 3. AlertManager 라우팅 설계 (FR-N57.5)

### 3.1 채널 분류

| 채널 | 수신 대상 | 알림 조건 |
|------|----------|----------|
| devops | DevOps 팀 | 인프라, Pod, 배포 관련 |
| dba | DBA 팀 | DB 연결, 슬로우 쿼리, 인덱스 |
| security | 보안 팀 | Falco, 정책 위반, 인증 실패 |
| sre | SRE 팀 | SLO 위반, 에러 버짓 소진 |
| management | 관리자 | critical 알림 요약 (에스컬레이션) |

### 3.2 라우팅 트리

```yaml
route:
  group_by: ["alertname", "namespace", "severity"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: "devops-default"
  routes:
    # SLO 위반 → SRE
    - matchers:
        - alertname=~".*SLO.*|.*ErrorBudget.*|.*BurnRate.*"
      receiver: "sre-team"
      group_wait: 10s
    # 보안 이벤트 → 보안팀
    - matchers:
        - alertname=~"Falco.*|PolicyViolation.*|AuthenticationFailure.*"
      receiver: "security-team"
      group_wait: 10s
    # DB 관련 → DBA
    - matchers:
        - team="dba"
      receiver: "dba-team"
    # Critical → 관리자 에스컬레이션
    - matchers:
        - severity="critical"
      receiver: "management-escalation"
      group_wait: 10s
      repeat_interval: 1h
      continue: true
```

### 3.3 억제 규칙 (FR-N57.6)

```yaml
inhibit_rules:
  # critical이 발생하면 동일 alertname의 warning 억제
  - source_matchers:
      - severity="critical"
    target_matchers:
      - severity="warning"
    equal: ["alertname", "namespace"]
  # 노드 다운 시 해당 노드의 Pod 알림 억제
  - source_matchers:
      - alertname="NodeDown"
    target_matchers:
      - alertname=~"Pod.*|Container.*"
    equal: ["instance"]
```

---

## 4. 구현 파일 목록

| 파일 | 설명 |
|------|------|
| `infra/monitoring/recording-rules.yaml` | PrometheusRule CRD (15개 recording rules) |
| `infra/monitoring/alertmanager-config.yaml` | AlertManager 라우팅 + 억제 규칙 |
| `scripts/test-monitoring-recording-rules.sh` | 통합 테스트 스크립트 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
