# MTU-N193: 노드 상태 상세 모니터링 — Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 노드 장애 사전 감지로 워크로드 스케줄링 영향 최소화 |
| 기술 | 노드 Condition(Ready/MemoryPressure/DiskPressure/PIDPressure) 추적 |
| 보안 | CSAP D-10 서비스 가용성, D-06 인프라 감사 로깅 |
| 운영 | 노드 비정상 상태 자동 감지, Cordon/Drain 사전 알림 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N193.1 | 노드 Condition 상태 recording rule | P0 | D-10 |
| FR-N193.2 | NotReady 노드 알림 | P0 | D-10 |
| FR-N193.3 | MemoryPressure/DiskPressure 알림 | P0 | D-06 |
| FR-N193.4 | Unschedulable 노드 알림 | P0 | D-10 |
| FR-N193.5 | 통합 대시보드 | P0 | D-10 |
| FR-N193.6 | E2E 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PrometheusRule | infra/monitoring/node-condition-rules.yaml |
| 2 | Grafana 대시보드 | infra/monitoring/dashboards/node-condition.json |
| 3 | E2E 테스트 | tests/monitoring/test-mtu-n193-node-condition.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
