# MTU-N239: 비즈니스 KPI 대시보드 자동화 -- Plan

> **버전**: 1.0 | **작성일**: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 플랫폼 핵심 KPI 실시간 시각화로 의사결정 지원 |
| 기술 | Prometheus 커스텀 메트릭 + Grafana 대시보드 |
| 보안 | KPI 데이터 N2SF O등급 분류, 접근 권한 제어 |
| 운영 | 주간/월간 KPI 보고서 자동 생성 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-KPI.1 | 핵심 비즈니스 메트릭 정의 (테넌트 수, MAU, 가용성) | P0 |
| FR-KPI.2 | Prometheus Recording Rules (KPI 산출) | P0 |
| FR-KPI.3 | Grafana Executive 대시보드 | P0 |
| FR-KPI.4 | KPI 임계값 알림 규칙 | P1 |
| FR-KPI.5 | 주간 KPI 보고서 자동 생성 스크립트 | P1 |

## 산출물

| 산출물 | 경로 |
|--------|------|
| Recording Rules | infra/monitoring/rules/business-kpi-rules.yaml |
| Alert Rules | infra/monitoring/alerts/business-kpi-alerts.yaml |
| 대시보드 | infra/monitoring/dashboards/business-kpi-dashboard.json |
| 보고서 스크립트 | scripts/generate-kpi-report.sh |
| 테스트 | scripts/test-business-kpi.sh |
