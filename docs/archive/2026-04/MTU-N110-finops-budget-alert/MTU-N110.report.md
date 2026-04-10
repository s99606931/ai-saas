# MTU-N110: FinOps 비용 예측 및 예산 자동 알림 — Report

> **MTU ID**: MTU-N110 | **완료일**: 2026-04-10 | **matchRate**: 100% (31/31)

## Executive Summary

| 관점 | 달성 |
|------|------|
| 비즈니스 | 100% - 3단계 티어별 예산 정책 + 월말 예측 |
| 기술 | 100% - Prophet 예측 + OpenCost 연동 + 7개 알림 규칙 |
| 보안 | 100% - N2SF O등급 데이터만 처리 |
| 운영 | 100% - 자동 알림 + 유휴 리소스 감지 + 6패널 대시보드 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 비용 예측 설정 | infra/finops/cost-prediction-config.yaml |
| 2 | 예산 정책 | infra/finops/budget-policy.yaml |
| 3 | AlertManager 규칙 | infra/finops/budget-alert-rules.yaml |
| 4 | Grafana 대시보드 | infra/finops/cost-prediction-dashboard.json |
| 5 | E2E 테스트 | tests/e2e/finops-budget-alert.test.sh |
