# MTU-N197: CronJob 실행 성공률 및 SLA 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 정기 배치 작업(백업, 감사 로그 수집 등) 실행 신뢰성 보장 |
| 기술 | kube_cronjob/kube_job 메트릭 기반 실행 이력 및 SLA 추적 |
| 보안 | CSAP D-06 감사 로그 수집 CronJob 신뢰성, D-10 서비스 가용성 |
| 운영 | CronJob 실패 패턴 감지, 실행 지연/누락 자동 알림 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | MTU-N183이 기본 Job/CronJob 모니터링 제공하나, SLA 기반 성공률 추적이 부재 |
| WHO | SRE 팀, 운영자 |
| RISK | CronJob 실패 미감지 시 백업 누락, 감사 로그 수집 중단 |
| SUCCESS | CronJob 성공률 99%+ SLA 달성 여부 실시간 추적 |
| SCOPE | CronJob SLA recording rule + 실패/지연 알림 + 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N197.1 | CronJob 성공률 recording rule (24h/7d) | P0 | D-10 |
| FR-N197.2 | CronJob 연속 실패 알림 | P0 | D-06 |
| FR-N197.3 | CronJob 실행 누락(예정 시간 초과) 알림 | P0 | D-10 |
| FR-N197.4 | CronJob 실행 시간 이상 감지 | P1 | D-10 |
| FR-N197.5 | CronJob SLA 통합 대시보드 | P0 | D-10 |
| FR-N197.6 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | CronJob SLA recording rules | infra/monitoring/cronjob-sla-rules.yaml |
| 2 | CronJob SLA alerting rules | infra/monitoring/cronjob-sla-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/cronjob-sla-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n197-cronjob-sla.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
