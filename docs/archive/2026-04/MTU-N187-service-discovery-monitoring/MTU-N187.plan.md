# MTU-N187: 서비스 디스커버리 모니터링 — Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 서비스 간 통신 가용성 보장으로 마이크로서비스 SLA 유지 |
| 기술 | CoreDNS 캐시·서비스 엔드포인트·Headless 서비스 상태 모니터링 |
| 보안 | CSAP D-08 접근 통제(서비스 간 통신 검증), D-10 가용성 |
| 운영 | 서비스 디스커버리 실패 자동 감지로 마이크로서비스 장애 사전 대응 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | MTU-N174에서 CoreDNS 해석 모니터링 구축했으나, Service Endpoint 상태·Headless 서비스·DNS 캐시 효율성 등 서비스 디스커버리 전체 관점의 모니터링 부재 |
| WHO | SRE 팀, 개발팀(마이크로서비스 간 통신 문제 진단) |
| RISK | Endpoint 누락/불일치 미감지 시 트래픽 유실, 서비스 간 통신 장애 |
| SUCCESS | 서비스 디스커버리 구성요소 100% 모니터링, 이상 징후 자동 알림 |
| SCOPE | PrometheusRule + Recording Rules + Grafana 대시보드 + E2E 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N187.1 | Service Endpoint 준비 상태 recording rule | P0 | D-10 |
| FR-N187.2 | Endpoint 없는 서비스 감지 알림 | P0 | D-10 |
| FR-N187.3 | CoreDNS 캐시 히트율 recording rule | P0 | D-10 |
| FR-N187.4 | CoreDNS 포워드 지연 recording rule | P1 | D-10 |
| FR-N187.5 | 서비스 디스커버리 통합 대시보드 | P0 | D-10 |
| FR-N187.6 | Headless 서비스 DNS 레코드 수 모니터링 | P1 | D-08 |
| FR-N187.7 | EndpointSlice 변경 빈도 recording rule | P1 | D-06 |
| FR-N187.8 | E2E 테스트 스크립트 | P0 | D-12 |

## 추적성 매트릭스

| FR ID | Design 섹션 | 산출물 | 테스트 | CSAP |
|-------|------------|--------|--------|------|
| FR-N187.1 | DS-N187.1 | service-discovery-rules.yaml | TC-N187.1 | D-10-03 |
| FR-N187.2 | DS-N187.2 | service-discovery-rules.yaml | TC-N187.2 | D-10-03 |
| FR-N187.3 | DS-N187.3 | service-discovery-rules.yaml | TC-N187.3 | D-10-03 |
| FR-N187.4 | DS-N187.4 | service-discovery-rules.yaml | TC-N187.4 | D-10-03 |
| FR-N187.5 | DS-N187.5 | service-discovery.json | TC-N187.5 | D-10-03 |
| FR-N187.6 | DS-N187.6 | service-discovery-rules.yaml | TC-N187.6 | D-08-01 |
| FR-N187.7 | DS-N187.7 | service-discovery-rules.yaml | TC-N187.7 | D-06-02 |
| FR-N187.8 | DS-N187.8 | test-mtu-n187.sh | TC-N187.8 | D-12-05 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PrometheusRule (Recording + Alerting) | infra/monitoring/service-discovery-rules.yaml |
| 2 | Grafana 대시보드 | infra/monitoring/dashboards/service-discovery.json |
| 3 | E2E 테스트 | tests/monitoring/test-mtu-n187-service-discovery.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
