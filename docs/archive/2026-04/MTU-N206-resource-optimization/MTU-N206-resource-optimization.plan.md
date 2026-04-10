# MTU-N206: 리소스 요청/제한 최적화 권고 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 리소스 over-provisioning 탐지로 비용 절감 및 클러스터 효율 향상 |
| 기술 | container_cpu_usage, container_memory_working_set vs requests/limits 비교 |
| 보안 | CSAP D-10 서비스 가용성, D-08 리소스 접근통제 |
| 운영 | FinOps 지표 연동, 테넌트별 리소스 효율 리포트 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 리소스 요청/제한이 실사용량 대비 과도하면 비용 낭비, 부족하면 OOM/스로틀링 |
| WHO | SRE팀, FinOps 담당, 테넌트 관리자 |
| RISK | Over-provisioning 미탐지 시 불필요 비용 지출. Under-provisioning 시 서비스 장애 |
| SUCCESS | 리소스 효율 비율 70~90% 대역 유지, over-provisioning > 200% 컨테이너 0 |
| SCOPE | CPU/메모리 효율 recording rules + over/under-provisioning 알림 + 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N206.1 | CPU 실사용량 대비 요청 효율 recording rule | P0 | D-10 |
| FR-N206.2 | 메모리 실사용량 대비 요청 효율 recording rule | P0 | D-10 |
| FR-N206.3 | Over-provisioning 컨테이너 탐지 recording rule (> 200%) | P0 | D-10 |
| FR-N206.4 | Under-provisioning 컨테이너 탐지 recording rule (> 90%) | P0 | D-10 |
| FR-N206.5 | Over-provisioning 알림 | P0 | D-10 |
| FR-N206.6 | Under-provisioning / 스로틀링 알림 | P0 | D-10 |
| FR-N206.7 | 리소스 최적화 권고 Grafana 대시보드 | P0 | D-10 |
| FR-N206.8 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/resource-optimization/resource-optimization-rules.yaml |
| 2 | Alerting rules | infra/monitoring/resource-optimization/resource-optimization-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/resource-optimization-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n206-resource-optimization.sh |

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N206.1 | Recording rules | E2E #1 | D-10 |
| FR-N206.2 | Recording rules | E2E #2 | D-10 |
| FR-N206.3 | Recording rules | E2E #3 | D-10 |
| FR-N206.4 | Recording rules | E2E #4 | D-10 |
| FR-N206.5 | Alerting rules | E2E #5 | D-10 |
| FR-N206.6 | Alerting rules | E2E #6 | D-10 |
| FR-N206.7 | 대시보드 | E2E #7 | D-10 |
| FR-N206.8 | E2E 테스트 | 자체 | D-12 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
