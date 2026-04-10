# MTU-N188: ConfigMap/Secret 변경 감지 모니터링 — Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 설정 변경으로 인한 서비스 장애 사전 감지 및 감사 추적 |
| 기술 | ConfigMap/Secret 변경 이벤트 추적, 변경 빈도 모니터링 |
| 보안 | CSAP D-06 감사 로깅(민감 설정 변경 전수 기록), D-09 암호화 관리 |
| 운영 | 설정 드리프트 자동 감지, 비인가 Secret 변경 알림 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | ConfigMap/Secret 변경은 서비스 장애의 주요 원인이며 CSAP D-06 감사 요건 필수 대상 |
| WHO | SRE 팀, 보안팀, 개발팀 |
| RISK | 비인가 Secret 변경 미감지 시 보안 사고, ConfigMap 오류로 서비스 장애 |
| SUCCESS | 모든 ConfigMap/Secret 변경 100% 추적, 비정상 변경 알림 |
| SCOPE | PrometheusRule + Recording Rules + Grafana 대시보드 + E2E 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N188.1 | ConfigMap 변경 빈도 recording rule | P0 | D-06 |
| FR-N188.2 | Secret 변경 빈도 recording rule | P0 | D-09 |
| FR-N188.3 | 비정상 시간대 변경 알림 (업무 시간 외) | P0 | D-06 |
| FR-N188.4 | 과다 변경 알림 (짧은 시간 내 다수 변경) | P0 | D-06 |
| FR-N188.5 | ConfigMap/Secret 총 개수 추적 | P1 | D-10 |
| FR-N188.6 | 통합 대시보드 | P0 | D-06 |
| FR-N188.7 | E2E 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PrometheusRule | infra/monitoring/configmap-secret-change-rules.yaml |
| 2 | Grafana 대시보드 | infra/monitoring/dashboards/configmap-secret-change.json |
| 3 | E2E 테스트 | tests/monitoring/test-mtu-n188-configmap-secret-change.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
