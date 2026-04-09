# Plan: MTU-N25 모니터링 대시보드 실전 구성

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 SaaS 운영 모니터링 가시성 확보 |
| 기술 | k3s + kube-prometheus-stack + Grafana ConfigMap sidecar |
| 보안 | CSAP D-06 모니터링 체계 증적 |
| 운영 | 대시보드 3종 + 알림 규칙 + 운영 가이드 |

---

## 기능 요구사항

| FR ID | 요구사항 | 수용 기준 | CSAP 매핑 |
|-------|---------|---------|----------|
| FR-N25.1 | k3s 클러스터 개요 대시보드 | ConfigMap → Grafana 자동 로딩 | D-06 |
| FR-N25.2 | Pod/Service 상태 대시보드 | 네임스페이스별 Pod 상태 표시 | D-06 |
| FR-N25.3 | Flux GitOps 현황 대시보드 | reconcile 상태, 소스 동기화 표시 | D-06 |
| FR-N25.4 | Prometheus 알림 규칙 활성화 | 최소 5개 규칙 firing 가능 | D-06 |
| FR-N25.5 | 모니터링 운영 가이드 문서 | 대시보드 접근법, 알림 대응 절차 | - |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| 클러스터 대시보드 ConfigMap | infra/monitoring/dashboards/cluster-overview.yaml |
| 서비스 상태 대시보드 ConfigMap | infra/monitoring/dashboards/service-status.yaml |
| GitOps 대시보드 ConfigMap | infra/monitoring/dashboards/gitops-status.yaml |
| 알림 규칙 | infra/monitoring/alerting-rules.yaml |
| 모니터링 운영 가이드 | docs/08-infra/monitoring-operations-guide.md |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
