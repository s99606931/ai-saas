# MTU-N107: AIOps 다변량 이상 탐지 고도화 — Report

> **MTU ID**: MTU-N107 | **완료일**: 2026-04-10 | **matchRate**: 100% (26/26)

## Executive Summary

| 관점 | 달성 |
|------|------|
| 비즈니스 | 100% - N83 단변량 -> 다변량 확장, 복합 이상 패턴 탐지 |
| 기술 | 100% - Isolation Forest 8차원 + LSTM Autoencoder + 5개 상관관계 규칙 |
| 보안 | 100% - 보안 이벤트 상관관계 분석 |
| 운영 | 100% - 알림 디듀플리케이션 + 억제 규칙 (노이즈 감소) |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 다변량 설정 | infra/anomaly-detection/multivariate-config.yaml |
| 2 | LSTM 설정 | infra/anomaly-detection/lstm-autoencoder.yaml |
| 3 | 학습 파이프라인 | infra/anomaly-detection/training-pipeline.yaml |
| 4 | 상관관계 규칙 | infra/anomaly-detection/correlation-rules.yaml |
| 5 | E2E 테스트 | tests/e2e/aiops-multivariate.test.sh |
