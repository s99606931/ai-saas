# MTU-N67: Flux Drift Detection + ConfigMap/Secret 감사

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | GitOps 거버넌스 강화, 수동 변경(kubectl edit) 자동 탐지/복구 |
| 기술 | Flux Drift Detection + ConfigMap/Secret 변경 감사 스크립트 + Prometheus 알림 |
| 보안 | CSAP D-06 변경 감사, D-08 무단 변경 탐지, 자동 복구(reconcile) |
| 운영 | 드리프트 발생 시 Slack/Prometheus 알림, 자동 복구 5분 이내 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N67.1 | Flux Kustomization drift detection 활성화 | P0 |
| FR-N67.2 | HelmRelease drift detection 활성화 | P0 |
| FR-N67.3 | ConfigMap 변경 감사 스크립트 | P0 |
| FR-N67.4 | Secret 변경 감사 스크립트 | P0 |
| FR-N67.5 | Prometheus 드리프트 알림 규칙 | P1 |
| FR-N67.6 | 드리프트 감사 로그 기록 | P1 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
