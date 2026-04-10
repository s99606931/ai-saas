# MTU-N110: FinOps 비용 예측 및 예산 자동 알림 — Plan

> **MTU ID**: MTU-N110
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | N97 대시보드 -> 비용 예측 + 예산 초과 자동 알림으로 비용 관리 고도화 |
| 기술 | OpenCost 기반 비용 데이터 + Prophet 예측 + AlertManager 알림 |
| 보안 | 비용 데이터는 O등급 (N2SF 준수) |
| 운영 | 월별 예산 대비 예측 초과 시 자동 Slack/이메일 알림 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N110.1 | 비용 예측 모델 설정 (네임스페이스별) | HIGH |
| FR-N110.2 | 예산 정책 정의 (티어별 월예산) | HIGH |
| FR-N110.3 | AlertManager 예산 초과 알림 규칙 | HIGH |
| FR-N110.4 | Grafana 비용 예측 대시보드 설정 | MED |
| FR-N110.5 | E2E 검증 테스트 | HIGH |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 비용 예측 설정 | infra/finops/cost-prediction-config.yaml |
| 2 | 예산 정책 | infra/finops/budget-policy.yaml |
| 3 | AlertManager 규칙 | infra/finops/budget-alert-rules.yaml |
| 4 | Grafana 대시보드 | infra/finops/cost-prediction-dashboard.json |
| 5 | E2E 테스트 | tests/e2e/finops-budget-alert.test.sh |
