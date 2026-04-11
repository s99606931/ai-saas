# Plan: MTU-N247 관찰성 고도화 (Pyroscope + 이상 감지 + SLO 대시보드)

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 장애 MTTR 50% 감소, 성능 병목 조기 식별 |
| 기술 | Pyroscope 프로파일링, OTel 트레이스-프로파일 연동, 이상 감지 규칙 |
| 보안 | 프로파일링 데이터 N2SF O등급 준수, PII 마스킹 |
| 운영 | SLO/SLA 대시보드 자동화, Grafana 프로비저닝 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-N247.1 | Pyroscope Helm 차트 + 서비스 연동 | P1 | Pyroscope UI 접근 |
| FR-N247.2 | OTel → Pyroscope 프로파일 전송 설정 | P1 | 트레이스-프로파일 연동 확인 |
| FR-N247.3 | SLO/SLA 대시보드 Grafana 프로비저닝 | P0 | 대시보드 자동 생성 |
| FR-N247.4 | 이상 감지 알림 규칙 강화 | P0 | 알림 규칙 적용 확인 |
| FR-N247.5 | SLO 에러 버짓 소진율 알림 | P1 | 에러 버짓 70% 소진 시 알림 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | Pyroscope Helm values | `infra/helm/pyroscope/values.yaml` |
| 2 | SLO 대시보드 JSON | `infra/monitoring/dashboards/slo-overview.json` |
| 3 | 이상 감지 알림 강화 | `infra/monitoring/anomaly-detection-enhanced.yaml` |
| 4 | SLO 에러 버짓 규칙 | `infra/monitoring/slo-error-budget-rules.yaml` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
