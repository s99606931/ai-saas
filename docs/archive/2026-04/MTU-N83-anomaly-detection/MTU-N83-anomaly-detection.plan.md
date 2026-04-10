# MTU-N83: 이상 탐지 ML 모델 — Plan

> **MTU ID**: MTU-N83
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | ML 기반 이상 탐지로 정적 임계값 한계 극복, 사전 장애 예방 |
| 기술 | Prophet 시계열 예측 + Prometheus 메트릭 + 비용 이상 탐지 |
| 보안 | 보안 이벤트 상관 분석, 이상 트래픽 자동 탐지 |
| 운영 | 자동 알림 + Runbook 연동, 오탐률 10% 미만 목표 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 정적 임계값 알림은 트래픽 패턴 변화에 대응 불가 |
| WHO | SRE 팀, 보안 담당자, FinOps 담당 |
| RISK | ML 모델 정확도 부족 시 오탐/미탐 → 학습 기간 + 튜닝 필요 |
| SUCCESS | 이상 탐지 자동화, 오탐률 < 10%, 사전 경고 30분+ |
| SCOPE | ML 예측 CronJob, 알림 규칙, 비용 이상 탐지, 보안 상관 분석 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N83.1 | Prometheus 메트릭 기반 이상 탐지 CronJob | HIGH |
| FR-N83.2 | CPU/메모리/레이턴시 시계열 예측 | HIGH |
| FR-N83.3 | 비용 이상 탐지 자동 알림 | HIGH |
| FR-N83.4 | 보안 이벤트 상관 분석 규칙 | MED |
| FR-N83.5 | 이상 탐지 Prometheus 알림 규칙 | HIGH |
| FR-N83.6 | 이상 탐지 결과 Grafana 대시보드 | MED |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 이상 탐지 CronJob | infra/anomaly-detection/cronjob.yaml |
| 2 | 탐지 설정 ConfigMap | infra/anomaly-detection/config.yaml |
| 3 | 비용 이상 탐지 알림 | infra/anomaly-detection/cost-anomaly-alerts.yaml |
| 4 | 보안 상관 분석 규칙 | infra/anomaly-detection/security-correlation.yaml |
| 5 | E2E 테스트 | tests/e2e/test-anomaly-detection.sh |
