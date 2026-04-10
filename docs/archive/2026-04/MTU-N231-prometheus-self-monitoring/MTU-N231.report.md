# MTU-N231: Prometheus 자체 성능/리소스 모니터링 — Report

> **작성일**: 2026-04-10
> **matchRate**: 100% (25/25 TC 통과)
> **상태**: 완료

## Executive Summary

| 관점 | 결과 |
|------|------|
| 비즈니스 | Prometheus 자체 성능 모니터링 — 전체 모니터링 시스템 가용성 보장 |
| 기술 | Recording Rules 12개 + Alert Rules 9개 + Grafana 대시보드 1개 |
| 보안 | CSAP D-06: 모니터링 인프라 자체 장애 탐지로 감사 체계 보호 |
| 운영 | TSDB 카디널리티, WAL, 규칙 평가, 리소스 다층 경고 |

## 산출물

| 산출물 | 경로 | 상태 |
|--------|------|------|
| Plan | docs/01-plan/mtus/MTU-N231-prometheus-self-monitoring.plan.md | 완료 |
| Design | docs/02-design/mtus/MTU-N231-prometheus-self-monitoring.design.md | 완료 |
| Recording Rules | infra/monitoring/prometheus-self-rules.yaml | 완료 |
| Alert Rules | infra/monitoring/prometheus-self-alerts.yaml | 완료 |
| 대시보드 | infra/monitoring/dashboards/prometheus-self-dashboard.json | 완료 |
| 검증 스크립트 | scripts/test-prometheus-self-monitoring.sh | 25/25 통과 |

## FR 달성 현황

| FR ID | 상태 | 검증 |
|-------|------|------|
| FR-N231.1 | 완료 | TC1~TC4 |
| FR-N231.2 | 완료 | TC5~TC8 |
| FR-N231.3 | 완료 | TC9~TC11 |
| FR-N231.4 | 완료 | TC12~TC15 |
| FR-N231.5 | 완료 | TC16~TC21 |
| FR-N231.6 | 완료 | TC22~TC25 |
