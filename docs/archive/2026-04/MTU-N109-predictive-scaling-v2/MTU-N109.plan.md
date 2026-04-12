# MTU-N109: ML 기반 예측 스케일링 고도화 — Plan

> **MTU ID**: MTU-N109
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10
> **복잡도**: HIGH

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | N93 기초 예측 -> 다변량 ML 예측으로 정확도 향상, 비용 절감 |
| 기술 | XGBoost + Prophet 앙상블, 다변량 특성 벡터, 자동 스케일링 연동 |
| 보안 | 리소스 예측으로 DoS 공격 시 자동 확장 방어 |
| 운영 | 사전 확장으로 SLO 위반 90% 사전 방지 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | N93 단일 메트릭 예측 한계, 다변량 상관관계 미반영 |
| WHO | SRE 팀, 인프라 담당 |
| RISK | 예측 실패 -> SLO 위반, 과다 프로비저닝 -> 비용 증가 |
| SUCCESS | 예측 정확도 85%+, SLO 위반 사전 방지율 90%+ |
| SCOPE | XGBoost 앙상블, Prophet 계절성, HPA 연동, 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N109.1 | XGBoost 다변량 예측 모델 설정 | HIGH |
| FR-N109.2 | Prophet 계절성 분해 + 앙상블 설정 | HIGH |
| FR-N109.3 | HPA Custom Metrics 연동 설정 | HIGH |
| FR-N109.4 | 예측 정확도 모니터링 대시보드 설정 | MED |
| FR-N109.5 | E2E 검증 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | XGBoost 예측 설정 | infra/predictive-scaling/xgboost-ensemble.yaml |
| 2 | Prophet 계절성 설정 | infra/predictive-scaling/prophet-seasonality.yaml |
| 3 | HPA 연동 설정 | infra/predictive-scaling/hpa-custom-metrics.yaml |
| 4 | 학습 파이프라인 | infra/predictive-scaling/training-cronjob.yaml |
| 5 | E2E 테스트 | tests/e2e/predictive-scaling-v2.test.sh |
