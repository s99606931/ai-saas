# MTU-N195: Webhook 호출 성능 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Admission Webhook 지연으로 인한 리소스 배포 병목 사전 감지 |
| 기술 | apiserver_admission_webhook_admission_duration_seconds 메트릭 기반 추적 |
| 보안 | CSAP D-08 접근 통제(Webhook이 보안 정책 시행), D-10 가용성 |
| 운영 | Webhook 레이턴시 SLO 위반, 거부율 급등 자동 알림 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Admission Webhook(Kyverno, Cert-Manager 등) 성능이 API 서버 응답에 직접 영향 |
| WHO | SRE 팀, 보안 운영자 |
| RISK | Webhook 타임아웃 시 failurePolicy에 따라 보안 정책 우회 또는 배포 차단 |
| SUCCESS | Webhook 레이턴시 p99 < 500ms, 거부율 이상 즉시 감지 |
| SCOPE | Admission Webhook 레이턴시 recording + 거부율 알림 + 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N195.1 | Webhook 레이턴시 recording rule (p50/p90/p99) | P0 | D-10 |
| FR-N195.2 | Webhook 레이턴시 SLO 위반 알림 (p99 > 500ms) | P0 | D-10 |
| FR-N195.3 | Webhook 거부율 recording rule | P0 | D-08 |
| FR-N195.4 | Webhook 거부율 급등 알림 | P0 | D-08 |
| FR-N195.5 | Webhook 타임아웃/에러 알림 | P0 | D-10 |
| FR-N195.6 | Webhook 성능 통합 대시보드 | P0 | D-10 |
| FR-N195.7 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Webhook 성능 recording rules | infra/monitoring/webhook-performance-rules.yaml |
| 2 | Webhook 성능 alerting rules | infra/monitoring/webhook-performance-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/webhook-performance-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n195-webhook-performance.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
