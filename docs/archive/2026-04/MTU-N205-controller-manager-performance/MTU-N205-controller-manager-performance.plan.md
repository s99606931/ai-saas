# MTU-N205: Controller Manager 성능 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Controller Manager 병목 조기 감지로 리소스 조정 지연 방지 |
| 기술 | workqueue_depth, workqueue_work_duration_seconds, workqueue_retries_total 메트릭 |
| 보안 | CSAP D-10 서비스 가용성, D-06 감사 로그 |
| 운영 | 워크큐 깊이 SLO, 처리 레이턴시 추적, 재시도 비율 감시 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Controller Manager는 Deployment/ReplicaSet 등 핵심 리소스 조정 담당. 큐 적체 = 서비스 불안정 |
| WHO | SRE팀, 플랫폼 운영자 |
| RISK | 워크큐 적체 미감지 시 리소스 조정 지연 및 연쇄 장애 |
| SUCCESS | 워크큐 깊이 < 100, 처리 레이턴시 p99 < 1s |
| SCOPE | Controller Manager 워크큐 메트릭 recording/alerting + Grafana 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N205.1 | 워크큐 깊이 (컨트롤러별) recording rule | P0 | D-10 |
| FR-N205.2 | 워크큐 처리 레이턴시 p50/p90/p99 recording rule | P0 | D-10 |
| FR-N205.3 | 워크큐 재시도 비율 recording rule | P0 | D-10 |
| FR-N205.4 | 워크큐 깊이 급등 알림 | P0 | D-10 |
| FR-N205.5 | 워크큐 처리 레이턴시 SLO 위반 알림 | P0 | D-10 |
| FR-N205.6 | Controller Manager 성능 통합 Grafana 대시보드 | P0 | D-10 |
| FR-N205.7 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/controller-manager/controller-manager-performance-rules.yaml |
| 2 | Alerting rules | infra/monitoring/controller-manager/controller-manager-performance-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/controller-manager-performance-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n205-controller-manager-performance.sh |

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N205.1 | Recording rules | E2E #1 | D-10 |
| FR-N205.2 | Recording rules | E2E #2 | D-10 |
| FR-N205.3 | Recording rules | E2E #3 | D-10 |
| FR-N205.4 | Alerting rules | E2E #4 | D-10 |
| FR-N205.5 | Alerting rules | E2E #5 | D-10 |
| FR-N205.6 | 대시보드 | E2E #6 | D-10 |
| FR-N205.7 | E2E 테스트 | 자체 | D-12 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
