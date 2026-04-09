# MTU-N47: Flux Drift Detection 자동 교정 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 클러스터 설정 변조 자동 탐지/교정으로 보안 사고 예방 |
| 기술 | Flux HelmRelease/Kustomization drift detection + 자동 교정 |
| 보안 | CSAP D-06 감사 추적 — 모든 drift 이벤트 기록, 자동 수정 |
| 운영 | Prometheus 알림 + Grafana 대시보드로 drift 현황 실시간 모니터링 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N47.1 | Flux HelmRelease drift detection enabled 설정 | 필수 |
| FR-N47.2 | Flux Kustomization drift detection 설정 | 필수 |
| FR-N47.3 | Drift 이벤트 Prometheus 알림 규칙 | 필수 |
| FR-N47.4 | Grafana Drift Detection 대시보드 | 필수 |
| FR-N47.5 | drift 자동 교정 + 감사 로그 웹훅 | 필수 |
| FR-N47.6 | 환경별(dev/stg/prod) drift 정책 차별화 | 권장 |
| FR-N47.7 | 테스트 스크립트 | 필수 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Drift detection 패치 | `infra/flux/drift-detection/` |
| 알림 규칙 | `infra/flux/drift-detection/alerting-rules.yaml` |
| Grafana 대시보드 | `infra/monitoring/dashboards/flux-drift-detection.json` |
| 설정 가이드 | `docs/operations/drift-detection-guide.md` |
| 테스트 스크립트 | `scripts/test-drift-detection.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
