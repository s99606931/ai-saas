# MTU-N204: Scheduler 성능 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 스케줄링 지연 조기 감지로 Pod 배치 실패 방지 |
| 기술 | scheduler_scheduling_algorithm_duration_seconds, scheduler_pending_pods 메트릭 |
| 보안 | CSAP D-10 서비스 가용성, D-08 접근통제 |
| 운영 | 스케줄링 SLO 관리, 대기 Pod 누적 감지, 실패 원인 분석 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Scheduler 지연은 전체 워크로드 배포 파이프라인에 영향. 사전 감지 필수 |
| WHO | SRE팀, 플랫폼 운영자 |
| RISK | 스케줄링 실패 미감지 시 서비스 배포 중단 및 SLA 위반 |
| SUCCESS | 스케줄링 p99 < 1s, pending pods 0 유지 |
| SCOPE | Scheduler 메트릭 recording/alerting rules + Grafana 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N204.1 | 스케줄링 알고리즘 레이턴시 p50/p90/p99 recording rule | P0 | D-10 |
| FR-N204.2 | 대기 Pod 수 (queue별) recording rule | P0 | D-10 |
| FR-N204.3 | 스케줄링 시도/실패 비율 recording rule | P0 | D-10 |
| FR-N204.4 | 스케줄링 레이턴시 SLO 위반 알림 | P0 | D-10 |
| FR-N204.5 | 대기 Pod 누적 알림 | P0 | D-10 |
| FR-N204.6 | Scheduler 성능 통합 Grafana 대시보드 | P0 | D-10 |
| FR-N204.7 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/scheduler/scheduler-performance-rules.yaml |
| 2 | Alerting rules | infra/monitoring/scheduler/scheduler-performance-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/scheduler-performance-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n204-scheduler-performance.sh |

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N204.1 | Recording rules | E2E #1 | D-10 |
| FR-N204.2 | Recording rules | E2E #2 | D-10 |
| FR-N204.3 | Recording rules | E2E #3 | D-10 |
| FR-N204.4 | Alerting rules | E2E #4 | D-10 |
| FR-N204.5 | Alerting rules | E2E #5 | D-10 |
| FR-N204.6 | 대시보드 | E2E #6 | D-10 |
| FR-N204.7 | E2E 테스트 | 자체 | D-12 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
