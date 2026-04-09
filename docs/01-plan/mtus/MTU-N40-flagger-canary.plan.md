# Plan: MTU-N40 Flagger 카나리 배포 전략

> **버전**: 1.0.0 | **작성일**: 2026-04-09

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 배포 실패 자동 감지 + 롤백, 서비스 가용성 99.9% |
| 기술 | Flagger + Prometheus + Traefik(k3s 기본 Ingress) |
| 보안 | CSAP D-12 배포 안전성, 메트릭 기반 검증 |
| 운영 | 카나리 단계별 트래픽 전환 (10% → 30% → 60% → 100%) |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N40.1 | Flagger Helm values 설정 | P0 |
| FR-N40.2 | Canary 리소스 정의 (api-gateway 시범) | P0 |
| FR-N40.3 | MetricTemplate: 요청 성공률 (>99%) | P0 |
| FR-N40.4 | MetricTemplate: 요청 지연시간 (<500ms p99) | P0 |
| FR-N40.5 | Flagger Alert Provider (Prometheus) | P1 |
| FR-N40.6 | 카나리 배포 운영 가이드 | P1 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | Flagger Helm values | `infra/flagger/values.yaml` |
| 2 | Canary 리소스 | `infra/flagger/canary-api-gateway.yaml` |
| 3 | MetricTemplates | `infra/flagger/metric-templates.yaml` |
| 4 | Alert Provider | `infra/flagger/alert-provider.yaml` |
| 5 | 운영 가이드 | `docs/framework/08-infra/canary-deployment-guide.md` |
