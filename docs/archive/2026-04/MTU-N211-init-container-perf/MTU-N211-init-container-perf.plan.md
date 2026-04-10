# MTU-N211: Init 컨테이너 성능 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Init 컨테이너 지연으로 인한 전체 Pod 기동 시간 병목 식별 |
| 기술 | kubelet_pod_start_sli_duration_seconds (init 단계), kube_pod_init_container_status |
| 보안 | CSAP D-10 가용성 |
| 운영 | Init 컨테이너 실패/지연 조기 감지 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N211.1 | Init 컨테이너 실행 시간 recording rule | P0 | D-10 |
| FR-N211.2 | Init 컨테이너 실패 횟수 recording rule | P0 | D-10 |
| FR-N211.3 | Init 컨테이너 지연/실패 알림 | P0 | D-10 |
| FR-N211.4 | 대시보드 | P0 | D-10 |
| FR-N211.5 | E2E 테스트 | P0 | D-12 |

## 산출물

| # | 경로 |
|---|------|
| 1 | infra/monitoring/init-container/init-container-perf-rules.yaml |
| 2 | infra/monitoring/init-container/init-container-perf-alerts.yaml |
| 3 | infra/monitoring/dashboards/init-container-perf-dashboard.json |
| 4 | tests/monitoring/test-mtu-n211-init-container-perf.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 | PM Lead |
