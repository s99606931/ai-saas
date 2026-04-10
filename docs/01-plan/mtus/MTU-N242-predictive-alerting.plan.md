# MTU-N242: 예측적 장애 방지 (Predictive Alerting) -- Plan

> **버전**: 1.0 | **작성일**: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 장애 발생 전 예측 알림으로 MTTR 0 달성 목표 |
| 기술 | Prometheus predict_linear() + 트렌드 분석 알림 규칙 |
| 보안 | 알림 데이터 N2SF O등급, 민감 정보 미포함 |
| 운영 | 예측 알림 정확도 추적, 오탐률 최소화 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-PA.1 | 디스크 용량 예측 알림 (4시간/24시간/7일 예측) | P0 |
| FR-PA.2 | 메모리 사용량 예측 알림 | P0 |
| FR-PA.3 | 인증서 만료 예측 알림 | P0 |
| FR-PA.4 | 에러율 추세 기반 SLO 위반 예측 | P1 |
| FR-PA.5 | 예측 대시보드 (트렌드 시각화) | P1 |

## 산출물

| 산출물 | 경로 |
|--------|------|
| 예측 알림 규칙 | infra/monitoring/alerts/predictive-alerts.yaml |
| 대시보드 | infra/monitoring/dashboards/predictive-alerting-dashboard.json |
| 테스트 | scripts/test-predictive-alerting.sh |
