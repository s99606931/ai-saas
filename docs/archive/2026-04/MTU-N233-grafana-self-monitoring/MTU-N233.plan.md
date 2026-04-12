# MTU-N233: Grafana 자체 성능 모니터링 — Plan

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **작성자**: PM 에이전트
> **상태**: 승인됨

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Grafana 대시보드 서비스의 응답 지연, 로그인 실패, 데이터소스 연결 상태 실시간 감시 |
| 기술 | Grafana 내장 `grafana_*` 메트릭 기반 API 성능, 데이터소스 헬스, 사용자 활동 모니터링 |
| 보안 | CSAP D-08: 인증 실패 모니터링, D-06: 대시보드 서비스 가용성 보장 |
| 운영 | SLO: API 응답 p99 < 3초, 데이터소스 연결 성공률 > 99%, 로그인 실패율 < 5% |

---

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N233.1 | Grafana API 응답 성능 (지연, 에러율) | Recording Rule 정의 |
| FR-N233.2 | 데이터소스 연결 상태 모니터링 | Alert Rule 정의 |
| FR-N233.3 | 사용자 인증/로그인 모니터링 | Recording Rule 정의 |
| FR-N233.4 | Grafana 리소스 사용량 (메모리, CPU) | Alert Rule 정의 |
| FR-N233.5 | Grafana 대시보드: 자체 성능 현황 | 대시보드 JSON |
| FR-N233.6 | 통합 알림: Grafana 장애 시 AlertManager 전달 | severity 분류 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Recording Rules | `infra/monitoring/grafana-self-rules.yaml` |
| Alert Rules | `infra/monitoring/grafana-self-alerts.yaml` |
| 대시보드 | `infra/monitoring/dashboards/grafana-self-dashboard.json` |
| 검증 스크립트 | `scripts/test-grafana-self-monitoring.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
