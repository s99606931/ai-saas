# MTU-N49: SLO/SLI 자동화 (Sloth) — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | SLO 기반 서비스 품질 관리로 공공기관 SLA 준수 보장 |
| 기술 | Sloth CRD → Prometheus recording/alerting rules 자동 생성 |
| 보안 | SLO 위반 = 잠재적 보안 사고 조기 탐지 (CSAP D-06) |
| 운영 | Grafana SLO 대시보드로 에러 버짓 실시간 모니터링 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N49.1 | Sloth CRD 정의 (핵심 서비스 SLO 5개+) | 필수 |
| FR-N49.2 | 가용성 SLO (99.9% target) | 필수 |
| FR-N49.3 | 지연시간 SLO (P95 < 500ms) | 필수 |
| FR-N49.4 | Prometheus recording rules 자동 생성 | 필수 |
| FR-N49.5 | Multi-window multi-burn 알림 | 필수 |
| FR-N49.6 | Grafana SLO 대시보드 | 필수 |
| FR-N49.7 | 에러 버짓 소진율 알림 | 필수 |
| FR-N49.8 | 테스트 스크립트 | 필수 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Sloth SLO 정의 | `infra/slo/` |
| Grafana SLO 대시보드 | `infra/monitoring/dashboards/slo-overview.json` |
| SLO 운영 가이드 | `docs/operations/slo-guide.md` |
| 테스트 스크립트 | `scripts/test-slo-automation.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
