# MTU-N205: Controller Manager 성능 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-controller-manager workqueue 메트릭 활용 |
| 메트릭 소스 | workqueue_depth, workqueue_work_duration_seconds, workqueue_retries_total, workqueue_adds_total |
| 수집 방식 | Prometheus ServiceMonitor (kube-prometheus-stack 기본 포함) |

## 상세 설계

### Recording Rules
```yaml
# 워크큐 깊이 (컨트롤러별)
controller_mgr_perf:workqueue_depth_by_name
controller_mgr_perf:workqueue_depth_total

# 워크큐 처리 레이턴시 퍼센타일
controller_mgr_perf:work_duration_p50
controller_mgr_perf:work_duration_p90
controller_mgr_perf:work_duration_p99

# 워크큐 대기 레이턴시 퍼센타일
controller_mgr_perf:queue_duration_p99

# 워크큐 재시도/추가 비율
controller_mgr_perf:retries_rate
controller_mgr_perf:adds_rate
controller_mgr_perf:longest_running_processor
```

### Alerting Rules

| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| ControllerManagerQueueDepthHigh | 워크큐 깊이 > 100 (5분간) | warning |
| ControllerManagerQueueDepthCritical | 워크큐 깊이 > 500 (5분간) | critical |
| ControllerManagerWorkDurationHigh | 처리 p99 > 1s | warning |
| ControllerManagerRetriesHigh | 재시도율 > 10/s (컨트롤러별) | warning |

### Grafana 대시보드 패널

| 패널 | 쿼리 | 시각화 |
|------|------|--------|
| 워크큐 깊이 (Top 10) | controller_mgr_perf:workqueue_depth_by_name | 타임시리즈 |
| 처리 레이턴시 | controller_mgr_perf:work_duration_p* | 타임시리즈 |
| 재시도율 | controller_mgr_perf:retries_rate | 타임시리즈 |
| 워크큐 추가율 | controller_mgr_perf:adds_rate | Stat |

## Session Guide

1. Recording rules 작성 (FR-N205.1~3)
2. Alerting rules 작성 (FR-N205.4~5)
3. Grafana 대시보드 작성 (FR-N205.6)
4. E2E 테스트 작성 (FR-N205.7)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
