# MTU-N206: 리소스 요청/제한 최적화 권고 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- cAdvisor + kube-state-metrics 조합 |
| 메트릭 소스 | container_cpu_usage_seconds_total, container_memory_working_set_bytes, kube_pod_container_resource_requests, kube_pod_container_resource_limits |
| 수집 방식 | Prometheus ServiceMonitor (kube-prometheus-stack 기본 포함) |

## 상세 설계

### Recording Rules
```yaml
# CPU 효율 (실사용 / 요청)
resource_opt:cpu_utilization_ratio
resource_opt:cpu_request_vs_usage

# 메모리 효율 (실사용 / 요청)
resource_opt:memory_utilization_ratio
resource_opt:memory_request_vs_usage

# Over-provisioning 탐지 (요청 > 실사용 200%)
resource_opt:cpu_over_provisioned_containers
resource_opt:memory_over_provisioned_containers

# Under-provisioning 탐지 (실사용 > 요청 90%)
resource_opt:cpu_under_provisioned_containers
resource_opt:memory_under_provisioned_containers

# CPU 스로틀링 비율
resource_opt:cpu_throttle_ratio

# 네임스페이스/워크로드별 효율 집계
resource_opt:namespace_cpu_efficiency
resource_opt:namespace_memory_efficiency
```

### Alerting Rules

| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| ResourceCPUOverProvisioned | CPU 요청 > 실사용 300% (1시간) | warning |
| ResourceMemoryOverProvisioned | 메모리 요청 > 실사용 300% (1시간) | warning |
| ResourceCPUUnderProvisioned | CPU 실사용 > 요청 90% (5분) | warning |
| ResourceMemoryUnderProvisioned | 메모리 실사용 > 요청 90% (5분) | critical |
| ResourceCPUThrottlingHigh | CPU 스로틀 비율 > 25% (5분) | warning |

### Grafana 대시보드 패널

| 패널 | 쿼리 | 시각화 |
|------|------|--------|
| CPU 효율 (네임스페이스별) | resource_opt:namespace_cpu_efficiency | 히트맵 |
| 메모리 효율 (네임스페이스별) | resource_opt:namespace_memory_efficiency | 히트맵 |
| Over-provisioned 컨테이너 목록 | resource_opt:cpu_over_provisioned_containers | 테이블 |
| Under-provisioned 컨테이너 목록 | resource_opt:cpu_under_provisioned_containers | 테이블 |
| CPU 스로틀링 비율 | resource_opt:cpu_throttle_ratio | 타임시리즈 |

## Session Guide

1. Recording rules 작성 (FR-N206.1~4)
2. Alerting rules 작성 (FR-N206.5~6)
3. Grafana 대시보드 작성 (FR-N206.7)
4. E2E 테스트 작성 (FR-N206.8)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
