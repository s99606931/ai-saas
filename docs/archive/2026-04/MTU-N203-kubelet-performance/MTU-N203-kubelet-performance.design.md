# MTU-N203: Kubelet 성능 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- Kubelet 내장 메트릭 활용 |
| 메트릭 소스 | kubelet_pod_start_duration_seconds, kubelet_pleg_relist_duration_seconds, kubelet_runtime_operations_duration_seconds |
| 수집 방식 | Prometheus ServiceMonitor (kube-prometheus-stack 기본 포함) |

## 상세 설계

### Recording Rules
```yaml
# Pod 기동 시간 히스토그램 퍼센타일
kubelet_perf:pod_start_duration_p50
kubelet_perf:pod_start_duration_p90
kubelet_perf:pod_start_duration_p99

# PLEG relist 레이턴시 퍼센타일
kubelet_perf:pleg_relist_duration_p50
kubelet_perf:pleg_relist_duration_p90
kubelet_perf:pleg_relist_duration_p99

# 컨테이너 런타임 작업 레이턴시
kubelet_perf:runtime_operations_duration_p99
kubelet_perf:runtime_operations_errors_rate

# Kubelet 전체 건강 지표
kubelet_perf:running_pods_count
kubelet_perf:running_containers_count
```

### Alerting Rules

| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| KubeletPodStartSlow | Pod 기동 p99 > 30s (5분간) | warning |
| KubeletPodStartVerySlow | Pod 기동 p99 > 60s (5분간) | critical |
| KubeletPLEGRelistSlow | PLEG relist p99 > 5s (5분간) | warning |
| KubeletPLEGRelistStuck | PLEG relist p99 > 10s (5분간) | critical |
| KubeletRuntimeOperationErrors | 런타임 작업 에러율 > 1% | warning |

### Grafana 대시보드 패널

| 패널 | 쿼리 | 시각화 |
|------|------|--------|
| Pod 기동 시간 추이 | kubelet_perf:pod_start_duration_p* | 타임시리즈 |
| PLEG Relist 레이턴시 | kubelet_perf:pleg_relist_duration_p* | 타임시리즈 |
| 런타임 작업 에러율 | kubelet_perf:runtime_operations_errors_rate | Stat |
| 실행 중 Pod/컨테이너 수 | kubelet_perf:running_* | Gauge |

## Session Guide

1. Recording rules 작성 (FR-N203.1~3)
2. Alerting rules 작성 (FR-N203.4~5)
3. Grafana 대시보드 작성 (FR-N203.6)
4. E2E 테스트 작성 (FR-N203.7)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
