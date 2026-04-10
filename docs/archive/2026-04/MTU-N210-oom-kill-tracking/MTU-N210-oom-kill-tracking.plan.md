# MTU-N210: OOM Kill 이벤트 추적 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | OOM Kill 이벤트 추적으로 메모리 부족 서비스 조기 식별 |
| 기술 | kube_pod_container_status_last_terminated_reason, container_oom_events_total |
| 보안 | CSAP D-10 가용성, D-06 감사 로그 |
| 운영 | OOM Kill 발생 즉시 알림, 워크로드별 메모리 제한 최적화 근거 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N210.1 | OOM Kill 발생 횟수 recording rule (네임스페이스/워크로드별) | P0 | D-10 |
| FR-N210.2 | OOM Kill 재발 빈도 recording rule | P0 | D-10 |
| FR-N210.3 | 컨테이너 메모리 사용률 vs limit 비율 | P0 | D-10 |
| FR-N210.4 | OOM Kill 발생 알림 | P0 | D-10 |
| FR-N210.5 | 반복 OOM Kill 알림 (같은 Pod 2회 이상) | P0 | D-10 |
| FR-N210.6 | OOM Kill 추적 대시보드 | P0 | D-10 |
| FR-N210.7 | E2E 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/oom/oom-kill-tracking-rules.yaml |
| 2 | Alerting rules | infra/monitoring/oom/oom-kill-tracking-alerts.yaml |
| 3 | 대시보드 | infra/monitoring/dashboards/oom-kill-tracking-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n210-oom-kill-tracking.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
