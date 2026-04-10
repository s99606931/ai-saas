# MTU-N207: Garbage Collection 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Go 런타임 GC 성능 추적으로 API 서버/컨트롤러 지연 원인 분석 |
| 기술 | go_gc_duration_seconds, go_memstats_*, process_resident_memory_bytes |
| 보안 | CSAP D-10 서비스 가용성 |
| 운영 | GC 빈도/레이턴시 SLO, 메모리 누수 조기 감지 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | k8s 컴포넌트(API 서버, 컨트롤러 등)는 Go 기반. GC 지연 = API 응답 지연 |
| WHO | SRE팀, 플랫폼 운영자 |
| RISK | GC 빈도 급증 또는 메모리 누수 미감지 시 컴포넌트 OOM 위험 |
| SUCCESS | GC 레이턴시 p99 < 100ms, 메모리 증가 추세 조기 감지 |
| SCOPE | Go 런타임 GC 메트릭 recording/alerting + Grafana 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N207.1 | GC 레이턴시 p50/p90/p99 recording rule | P0 | D-10 |
| FR-N207.2 | GC 빈도 (초당 횟수) recording rule | P0 | D-10 |
| FR-N207.3 | 힙 메모리 사용량/할당량 recording rule | P0 | D-10 |
| FR-N207.4 | GC 레이턴시 SLO 위반 알림 | P0 | D-10 |
| FR-N207.5 | 메모리 누수 의심 알림 (지속 증가) | P0 | D-10 |
| FR-N207.6 | GC 모니터링 Grafana 대시보드 | P0 | D-10 |
| FR-N207.7 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/gc/gc-monitoring-rules.yaml |
| 2 | Alerting rules | infra/monitoring/gc/gc-monitoring-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/gc-monitoring-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n207-gc-monitoring.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
