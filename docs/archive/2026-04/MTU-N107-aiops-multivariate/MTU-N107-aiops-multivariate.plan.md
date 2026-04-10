# MTU-N107: AIOps 다변량 이상 탐지 고도화 — Plan

> **MTU ID**: MTU-N107
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10
> **복잡도**: HIGH

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 단변량 Z-Score(N83) -> 다변량 ML 이상 탐지로 오탐 감소 및 복합 이상 패턴 탐지 |
| 기술 | Isolation Forest + LSTM Autoencoder + 다변량 상관관계 분석 |
| 보안 | 보안 이벤트 상관관계 분석 (N2SF 침해 탐지) |
| 운영 | 알림 노이즈 80% 감소, MTTR 50% 단축 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | N83 Z-Score 단변량 탐지 한계: 다변량 상관 패턴 미탐지, 오탐 과다 |
| WHO | SRE 팀, 보안 운영, 인프라 담당 |
| RISK | 복합 장애 패턴 미탐지, 알림 피로 |
| SUCCESS | 다변량 모델 학습 + 복합 이상 탐지 + 알림 노이즈 감소 |
| SCOPE | 다변량 모델 설정, 학습 파이프라인, 상관관계 분석, 알림 연동 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N107.1 | Isolation Forest 다변량 이상 탐지 설정 | HIGH |
| FR-N107.2 | LSTM Autoencoder 시계열 이상 탐지 설정 | HIGH |
| FR-N107.3 | 메트릭 상관관계 분석 설정 | HIGH |
| FR-N107.4 | 학습 파이프라인 CronJob | MED |
| FR-N107.5 | AlertManager 연동 (디듀플리케이션) | HIGH |
| FR-N107.6 | E2E 검증 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 다변량 탐지 설정 | infra/anomaly-detection/multivariate-config.yaml |
| 2 | LSTM 모델 설정 | infra/anomaly-detection/lstm-autoencoder.yaml |
| 3 | 학습 파이프라인 | infra/anomaly-detection/training-pipeline.yaml |
| 4 | 상관관계 규칙 | infra/anomaly-detection/correlation-rules.yaml |
| 5 | E2E 테스트 | tests/e2e/aiops-multivariate.test.sh |
