# MTU-N191: Namespace 리소스 쿼터 모니터링 — Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 테넌트별 리소스 쿼터 고갈 사전 감지로 배포 차단 방지 |
| 기술 | ResourceQuota/LimitRange 사용률 모니터링, 고갈 예측 알림 |
| 보안 | CSAP D-10 서비스 가용성, D-08 접근 통제(테넌트 격리) |
| 운영 | 쿼터 고갈 자동 알림, 테넌트 리소스 사용 추세 시각화 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 멀티테넌시 환경에서 ResourceQuota 고갈 시 새 Pod 배포 불가, 서비스 영향 발생 |
| WHO | SRE 팀, 테넌트 관리자 |
| RISK | 쿼터 고갈 미감지 → 배포 차단 → 서비스 업데이트 불가 |
| SUCCESS | 쿼터 사용률 100% 추적, 고갈 임박 시 자동 알림 |
| SCOPE | PrometheusRule + Grafana 대시보드 + E2E 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N191.1 | CPU/Memory 쿼터 사용률 recording rule | P0 | D-10 |
| FR-N191.2 | Pod 수 쿼터 사용률 recording rule | P0 | D-10 |
| FR-N191.3 | 쿼터 사용률 80%/90% 알림 | P0 | D-10 |
| FR-N191.4 | 쿼터 초과 거부 이벤트 알림 | P0 | D-06 |
| FR-N191.5 | 통합 대시보드 | P0 | D-10 |
| FR-N191.6 | E2E 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PrometheusRule | infra/monitoring/namespace-quota-rules.yaml |
| 2 | Grafana 대시보드 | infra/monitoring/dashboards/namespace-quota.json |
| 3 | E2E 테스트 | tests/monitoring/test-mtu-n191-namespace-quota.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
