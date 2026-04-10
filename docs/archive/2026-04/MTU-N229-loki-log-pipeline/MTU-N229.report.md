# MTU-N229: Loki 로그 수집 파이프라인 모니터링 — Report

> **작성일**: 2026-04-10
> **matchRate**: 100% (24/24 TC 통과)
> **상태**: 완료

## Executive Summary

| 관점 | 결과 |
|------|------|
| 비즈니스 | Loki 로그 파이프라인 전 구간 모니터링 구축 — 수집 장애 5분 이내 탐지 |
| 기술 | Recording Rules 8개 + Alert Rules 10개 + Grafana 대시보드 1개 |
| 보안 | CSAP D-06 로그 무결성: 드롭률, 누락, 파이프라인 장애 실시간 알림 |
| 운영 | 2단계 severity (warning/critical), 런북 자동 링크 |

## 산출물

| 산출물 | 경로 | 상태 |
|--------|------|------|
| Plan | docs/01-plan/mtus/MTU-N229-loki-log-pipeline.plan.md | 완료 |
| Design | docs/02-design/mtus/MTU-N229-loki-log-pipeline.design.md | 완료 |
| Recording Rules | infra/monitoring/loki-pipeline-rules.yaml | 완료 |
| Alert Rules | infra/monitoring/loki-pipeline-alerts.yaml | 완료 |
| 대시보드 | infra/monitoring/dashboards/loki-pipeline-dashboard.json | 완료 |
| 검증 스크립트 | scripts/test-loki-pipeline-monitoring.sh | 24/24 통과 |

## FR 달성 현황

| FR ID | 상태 | 검증 |
|-------|------|------|
| FR-N229.1 | 완료 | TC1~TC4 통과 |
| FR-N229.2 | 완료 | TC5~TC9 통과 |
| FR-N229.3 | 완료 | TC10~TC11 통과 |
| FR-N229.4 | 완료 | TC12~TC13 통과 |
| FR-N229.5 | 완료 | TC14~TC19 통과 |
| FR-N229.6 | 완료 | TC20~TC24 통과 |
