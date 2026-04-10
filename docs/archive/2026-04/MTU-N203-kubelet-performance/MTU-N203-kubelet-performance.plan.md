# MTU-N203: Kubelet 성능 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Kubelet 성능 추적으로 Pod 기동 지연 및 노드 이상 조기 감지 |
| 기술 | kubelet_pod_start_duration_seconds, kubelet_pleg_relist_duration_seconds 메트릭 |
| 보안 | CSAP D-10 서비스 가용성, D-06 감사 로그 |
| 운영 | Pod 기동 SLO 관리, PLEG 레이턴시 이상 탐지, 노드 안정성 보장 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Kubelet은 노드 수준 Pod 관리의 핵심. PLEG 지연은 Pod 상태 갱신 실패 유발 |
| WHO | SRE팀, 플랫폼 운영자, 테넌트 관리자 |
| RISK | PLEG 레이턴시 급등 미감지 시 Pod 스케줄링 실패 및 서비스 장애 |
| SUCCESS | Pod 기동 p99 < 30s, PLEG relist p99 < 5s SLO 달성 |
| SCOPE | Kubelet 메트릭 recording/alerting rules + Grafana 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N203.1 | Pod 기동 시간 p50/p90/p99 recording rule | P0 | D-10 |
| FR-N203.2 | PLEG relist 레이턴시 p50/p90/p99 recording rule | P0 | D-10 |
| FR-N203.3 | 컨테이너 런타임 작업 레이턴시 recording rule | P0 | D-10 |
| FR-N203.4 | Pod 기동 시간 SLO 위반 알림 | P0 | D-10 |
| FR-N203.5 | PLEG relist 레이턴시 급등 알림 | P0 | D-10 |
| FR-N203.6 | Kubelet 성능 통합 Grafana 대시보드 | P0 | D-10 |
| FR-N203.7 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/kubelet/kubelet-performance-rules.yaml |
| 2 | Alerting rules | infra/monitoring/kubelet/kubelet-performance-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/kubelet-performance-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n203-kubelet-performance.sh |

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N203.1 | Recording rules | E2E #1 | D-10 |
| FR-N203.2 | Recording rules | E2E #2 | D-10 |
| FR-N203.3 | Recording rules | E2E #3 | D-10 |
| FR-N203.4 | Alerting rules | E2E #4 | D-10 |
| FR-N203.5 | Alerting rules | E2E #5 | D-10 |
| FR-N203.6 | 대시보드 | E2E #6 | D-10 |
| FR-N203.7 | E2E 테스트 | 자체 | D-12 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
