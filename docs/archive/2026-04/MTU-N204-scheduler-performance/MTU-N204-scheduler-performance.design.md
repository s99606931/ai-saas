# MTU-N204: Scheduler 성능 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-scheduler 내장 메트릭 활용 |
| 메트릭 소스 | scheduler_scheduling_algorithm_duration_seconds, scheduler_pending_pods, scheduler_schedule_attempts_total |
| 수집 방식 | Prometheus ServiceMonitor (kube-prometheus-stack 기본 포함) |

## 상세 설계

### Recording Rules
```yaml
# 스케줄링 알고리즘 레이턴시 퍼센타일
scheduler_perf:algorithm_duration_p50
scheduler_perf:algorithm_duration_p90
scheduler_perf:algorithm_duration_p99

# 대기 Pod 수 (queue별)
scheduler_perf:pending_pods_by_queue

# 스케줄링 시도/실패 비율
scheduler_perf:schedule_attempts_rate
scheduler_perf:schedule_failure_rate
scheduler_perf:unschedulable_pods_count

# E2E 스케줄링 레이턴시
scheduler_perf:e2e_scheduling_duration_p99
```

### Alerting Rules

| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| SchedulerLatencyHigh | 알고리즘 p99 > 1s | warning |
| SchedulerLatencyCritical | 알고리즘 p99 > 5s | critical |
| SchedulerPendingPodsHigh | 대기 Pod > 10 (10분간) | warning |
| SchedulerFailureRateHigh | 실패율 > 5% | critical |

### Grafana 대시보드 패널

| 패널 | 쿼리 | 시각화 |
|------|------|--------|
| 스케줄링 알고리즘 레이턴시 | scheduler_perf:algorithm_duration_p* | 타임시리즈 |
| 대기 Pod 수 | scheduler_perf:pending_pods_by_queue | 타임시리즈 |
| 스케줄링 성공/실패 비율 | scheduler_perf:schedule_*_rate | Stat |
| E2E 스케줄링 레이턴시 | scheduler_perf:e2e_scheduling_duration_p99 | Gauge |

## Session Guide

1. Recording rules 작성 (FR-N204.1~3)
2. Alerting rules 작성 (FR-N204.4~5)
3. Grafana 대시보드 작성 (FR-N204.6)
4. E2E 테스트 작성 (FR-N204.7)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
