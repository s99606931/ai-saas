# MTU-N232: AlertManager 알림 전달 성능 모니터링 — Plan

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **작성자**: PM 에이전트
> **상태**: 승인됨

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AlertManager 알림 전달 지연/실패를 감지하여 장애 알림 누락 방지 |
| 기술 | AlertManager 내장 메트릭 기반 알림 전달 성공률, 지연, 억제/무음 현황 모니터링 |
| 보안 | CSAP D-06: 알림 전달 실패 = 침해사고 탐지 불가. 알림 채널 가용성 보장 |
| 운영 | SLO: 알림 전달 성공률 > 99%, 전달 지연 < 30초, 알림 큐 포화 없음 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | AlertManager는 Prometheus 알림의 최종 전달 체계. 전달 실패 시 장애 미인지 |
| WHO | SRE, DevOps, 보안 관리자 |
| RISK | 알림 전달 실패 → 장애 미탐지 → SLA 위반 → CSAP 위반 |
| SUCCESS | 전달 실패/지연 즉시 탐지, 억제/무음 현황 가시화 |
| SCOPE | AlertManager 알림 전달 파이프라인 (수신→그룹핑→억제→전달) |

---

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N232.1 | 알림 전달 성공률/실패율 메트릭 수집 | Recording Rule 정의 |
| FR-N232.2 | 알림 전달 지연 모니터링 | Recording Rule 정의 |
| FR-N232.3 | 알림 억제(inhibition)/무음(silence) 현황 추적 | Recording Rule 정의 |
| FR-N232.4 | AlertManager 자체 상태 모니터링 (클러스터, 피어) | Alert Rule 정의 |
| FR-N232.5 | Grafana 대시보드: 알림 전달 성능 현황 | 대시보드 JSON |
| FR-N232.6 | 통합 알림: 전달 실패 시 백업 채널 경고 | severity 분류 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Plan | `docs/01-plan/mtus/MTU-N232-alertmanager-delivery-perf.plan.md` |
| Design | `docs/02-design/mtus/MTU-N232-alertmanager-delivery-perf.design.md` |
| Recording Rules | `infra/monitoring/alertmanager-delivery-rules.yaml` |
| Alert Rules | `infra/monitoring/alertmanager-delivery-alerts.yaml` |
| Grafana 대시보드 | `infra/monitoring/dashboards/alertmanager-delivery-dashboard.json` |
| 검증 스크립트 | `scripts/test-alertmanager-delivery-monitoring.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
