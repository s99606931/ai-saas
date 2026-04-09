# MTU-N50: 카오스 엔지니어링 (Litmus) — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 장애 복원력 검증으로 공공기관 서비스 연속성 보장 |
| 기술 | LitmusChaos CRD 기반 선언적 카오스 실험 (Pod/Network/CPU) |
| 보안 | 카오스 실험도 RBAC + 감사 추적 (CSAP D-06, D-08) |
| 운영 | 정기적 복원력 테스트 → SLO 영향 분석 → 개선 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N50.1 | Litmus ChaosCenter Helm values | 필수 |
| FR-N50.2 | Pod 장애 실험 (kill, CPU stress) | 필수 |
| FR-N50.3 | 네트워크 장애 실험 (latency, loss) | 필수 |
| FR-N50.4 | 카오스 실험 워크플로우 정의 | 필수 |
| FR-N50.5 | Prometheus 카오스 메트릭 연동 | 필수 |
| FR-N50.6 | 복원력 테스트 Runbook | 필수 |
| FR-N50.7 | 테스트 스크립트 | 필수 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Litmus values | `infra/chaos/litmus-values.yaml` |
| 카오스 실험 | `infra/chaos/experiments/` |
| Runbook | `docs/operations/chaos-runbook.md` |
| 테스트 스크립트 | `scripts/test-chaos-engineering.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
