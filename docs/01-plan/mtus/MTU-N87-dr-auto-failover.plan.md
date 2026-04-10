# MTU-N87: 재해복구 자동 페일오버 — Plan

> **MTU ID**: MTU-N87
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | RTO < 15분, RPO < 5분 달성으로 서비스 연속성 보장 |
| 기술 | Active-Passive 클러스터 + Velero 동기화 + 자동 페일오버 |
| 보안 | CSAP D-13 재해복구 요건 자동화, 백업 암호화 |
| 운영 | 자동 헬스체크 → 페일오버 → 복구 → 알림 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N87.1 | Active-Passive DR 아키텍처 설정 | HIGH |
| FR-N87.2 | 자동 헬스체크 + 페일오버 트리거 | HIGH |
| FR-N87.3 | Velero 크로스 클러스터 백업 동기화 | HIGH |
| FR-N87.4 | 페일오버 Runbook 자동화 | HIGH |
| FR-N87.5 | DR 테스트 자동화 (주간) | MED |
| FR-N87.6 | 페일백(Failback) 절차 자동화 | MED |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | DR 아키텍처 설정 | infra/dr/architecture.yaml |
| 2 | 자동 페일오버 CronJob | infra/dr/failover-controller.yaml |
| 3 | DR 테스트 자동화 | infra/dr/dr-test-cronjob.yaml |
| 4 | 알림 규칙 | infra/dr/alerting-rules.yaml |
| 5 | E2E 테스트 | tests/e2e/test-dr-failover.sh |
