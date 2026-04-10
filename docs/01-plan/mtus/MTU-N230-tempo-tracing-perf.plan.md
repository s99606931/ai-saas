# MTU-N230: Tempo 분산 추적 성능 모니터링 — Plan

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **작성자**: PM 에이전트
> **상태**: 승인됨

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Tempo 기반 분산 추적 시스템의 수집 성능, 쿼리 지연, 스토리지 효율 실시간 감시 |
| 기술 | Tempo ingester/querier/compactor 내장 메트릭 기반 Recording/Alert Rules + Grafana 대시보드 |
| 보안 | CSAP D-06 트레이스 무결성: 트레이스 드롭/수집 중단 탐지 |
| 운영 | SLO: 트레이스 수집 지연 p99 < 3초, 드롭률 < 0.5%, Tempo 가용성 99.9% |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Tempo 분산 추적은 마이크로서비스 장애 근인 분석의 핵심. 수집 장애 시 추적 불가 |
| WHO | SRE, DevOps, 개발팀 |
| RISK | 트레이스 누락 시 장애 근인 분석 불가, 서비스 간 지연 원인 추적 실패 |
| SUCCESS | Tempo 수집/쿼리 이상 5분 이내 탐지, WAL 크기 증가 사전 알림 |
| SCOPE | Tempo ingester, querier, compactor, metrics_generator 전 구간 |

---

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N230.1 | Tempo ingester 수집률/드롭률 메트릭 수집 | Recording Rule 정의 |
| FR-N230.2 | Tempo 쿼리 성능 모니터링 (TraceQL 지연, 타임아웃) | Alert Rule 정의 |
| FR-N230.3 | Tempo WAL/스토리지 사용량 추적 | Recording Rule 정의 |
| FR-N230.4 | Tempo compactor 성능 모니터링 | Recording Rule 정의 |
| FR-N230.5 | Grafana 대시보드: Tempo 성능 전체 현황 | 대시보드 JSON 생성 |
| FR-N230.6 | 통합 알림: Tempo 장애 시 AlertManager 전달 | Alert severity 분류 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Plan 문서 | `docs/01-plan/mtus/MTU-N230-tempo-tracing-perf.plan.md` |
| Design 문서 | `docs/02-design/mtus/MTU-N230-tempo-tracing-perf.design.md` |
| Recording Rules | `infra/monitoring/tempo-performance-rules.yaml` |
| Alert Rules | `infra/monitoring/tempo-performance-alerts.yaml` |
| Grafana 대시보드 | `infra/monitoring/dashboards/tempo-performance-dashboard.json` |
| 검증 스크립트 | `scripts/test-tempo-performance-monitoring.sh` |
| Report | `docs/04-report/MTU-N230.report.md` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
