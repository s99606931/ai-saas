# MTU-N189: Pod 리소스 제한 위반 모니터링 — Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N189-pod-resource-limit-monitoring.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 옵션 | Pragmatic Balance — cadvisor + kube-state-metrics |
| 데이터 소스 | cadvisor (실제 사용량), kube-state-metrics (limits/requests, OOMKilled) |
| 대시보드 | Grafana JSON Provisioning |

## DS-N189.1: CPU Throttling 비율

```promql
# CPU Throttling 비율 (%)
rate(container_cpu_cfs_throttled_periods_total[5m])
  / rate(container_cpu_cfs_periods_total[5m])
```

## DS-N189.2: Memory 사용률 vs Limit

```promql
# Memory 사용률 / Limit 비율
container_memory_working_set_bytes
  / kube_pod_container_resource_limits{resource="memory"}
```

## DS-N189.3: OOMKilled 추적

```promql
# OOMKilled 발생 컨테이너
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}
# OOMKilled 재시작 횟수
kube_pod_container_status_restarts_total
  * on(namespace,pod,container)
  kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}
```

## DS-N189.4~6: 알림 규칙

| 알림 | 조건 | 심각도 |
|------|------|--------|
| CPUThrottlingHigh | Throttling > 25% (5분 지속) | warning |
| CPUThrottlingSevere | Throttling > 50% (3분 지속) | critical |
| MemoryLimitApproaching | Memory/Limit > 90% | warning |
| MemoryLimitCritical | Memory/Limit > 95% | critical |
| OOMKilledDetected | OOMKilled 발생 | warning |
| OOMKilledRepeated | 1시간 내 OOMKilled 2회+ | critical |

## DS-N189.7: 대시보드 패널

| 행 | 패널 | 타입 |
|----|------|------|
| 0 | 리소스 상태 개요 | stat |
| 1 | CPU Throttling Top 10 | timeseries |
| 2 | Memory 사용률 vs Limit | timeseries |
| 3 | OOMKilled 이벤트 타임라인 | timeseries |
| 4 | CPU 사용률 vs Request vs Limit | timeseries |
| 5 | 컨테이너별 리소스 효율성 | table |
| 6 | OOMKilled 재시작 횟수 | bargauge |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
