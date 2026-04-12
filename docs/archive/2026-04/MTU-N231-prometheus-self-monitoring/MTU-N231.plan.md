# MTU-N231: Prometheus 자체 성능/리소스 모니터링 — Plan

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **작성자**: PM 에이전트
> **상태**: 승인됨

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Prometheus 자체 성능 저하를 사전 탐지하여 전체 모니터링 시스템 안정성 보장 |
| 기술 | Prometheus 내장 메트릭(`prometheus_*`) 기반 수집 성능, TSDB, WAL, 규칙 평가 모니터링 |
| 보안 | CSAP D-06: 모니터링 시스템 자체 가용성 = 감사 로깅 인프라 기반 |
| 운영 | SLO: 스크랩 성공률 > 99%, 규칙 평가 지연 < 10초, TSDB 용량 70% 미만 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Prometheus가 모니터링 시스템의 핵심. 자체 장애 시 전체 알림 체계 무력화 |
| WHO | SRE, DevOps |
| RISK | Prometheus 과부하 시 메트릭 수집 실패 → 장애 미탐지 → CSAP 위반 |
| SUCCESS | TSDB 용량/WAL 증가/스크랩 실패를 사전 경고하여 장애 예방 |
| SCOPE | kube-prometheus-stack Prometheus 서버 자체 성능 |

---

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N231.1 | 스크랩 성능 모니터링 (성공률, 지연, 대상 수) | Recording Rule 정의 |
| FR-N231.2 | TSDB 성능 모니터링 (헤드 시리즈, 청크, WAL) | Recording Rule 정의 |
| FR-N231.3 | 규칙 평가 성능 모니터링 (지연, 실패) | Alert Rule 정의 |
| FR-N231.4 | Prometheus 리소스 사용량 (CPU, 메모리, 디스크) | Alert Rule 정의 |
| FR-N231.5 | Grafana 대시보드: Prometheus 자체 성능 현황 | 대시보드 JSON |
| FR-N231.6 | 통합 알림: Prometheus 자체 장애 AlertManager 전달 | severity 분류 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Plan 문서 | `docs/01-plan/mtus/MTU-N231-prometheus-self-monitoring.plan.md` |
| Design 문서 | `docs/02-design/mtus/MTU-N231-prometheus-self-monitoring.design.md` |
| Recording Rules | `infra/monitoring/prometheus-self-rules.yaml` |
| Alert Rules | `infra/monitoring/prometheus-self-alerts.yaml` |
| Grafana 대시보드 | `infra/monitoring/dashboards/prometheus-self-dashboard.json` |
| 검증 스크립트 | `scripts/test-prometheus-self-monitoring.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
