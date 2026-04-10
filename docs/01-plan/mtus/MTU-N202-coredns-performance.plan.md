# MTU-N202: CoreDNS 성능 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | DNS 해석 성능 추적으로 서비스 간 통신 안정성 보장 |
| 기술 | coredns_dns_request_duration_seconds, coredns_dns_responses_total 메트릭 |
| 보안 | CSAP D-10 서비스 가용성, D-08 DNS 기반 서비스 접근 |
| 운영 | DNS 레이턴시 SLO, NXDOMAIN/SERVFAIL 급등 감지 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N202.1 | DNS 레이턴시 p50/p90/p99 recording rule | P0 | D-10 |
| FR-N202.2 | DNS 응답 코드별(NOERROR/NXDOMAIN/SERVFAIL) 비율 | P0 | D-10 |
| FR-N202.3 | DNS 레이턴시 SLO 위반 알림 | P0 | D-10 |
| FR-N202.4 | SERVFAIL 급등 알림 | P0 | D-10 |
| FR-N202.5 | CoreDNS 성능 통합 대시보드 | P0 | D-10 |
| FR-N202.6 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/dns/coredns-performance-rules.yaml |
| 2 | Alerting rules | infra/monitoring/dns/coredns-performance-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/coredns-performance-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n202-coredns-performance.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
