# MTU-N198: Endpoint/EndpointSlice 가용성 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 서비스 Endpoint 가용성 실시간 추적으로 트래픽 라우팅 장애 사전 감지 |
| 기술 | kube_endpoint_address/kube_endpointslice 메트릭 기반 Ready/NotReady 추적 |
| 보안 | CSAP D-10 서비스 가용성, D-08 접근 통제(서비스 접근 경로) |
| 운영 | Endpoint 0개 서비스 즉시 알림, Ready 비율 하락 감지 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N198.1 | Endpoint Ready/NotReady 수 recording rule | P0 | D-10 |
| FR-N198.2 | Endpoint 0개 서비스 즉시 알림 | P0 | D-10 |
| FR-N198.3 | Endpoint Ready 비율 하락 알림 | P0 | D-10 |
| FR-N198.4 | EndpointSlice 현황 추적 | P1 | D-10 |
| FR-N198.5 | Endpoint 가용성 통합 대시보드 | P0 | D-10 |
| FR-N198.6 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/endpoint-availability-rules.yaml |
| 2 | Alerting rules | infra/monitoring/endpoint-availability-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/endpoint-availability-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n198-endpoint-availability.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
