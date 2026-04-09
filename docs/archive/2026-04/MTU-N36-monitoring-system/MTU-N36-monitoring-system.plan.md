# MTU-N36: 통합 모니터링 시스템 구축 + 사용자 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead
> **복잡도**: HIGH | **의존**: MTU-I4, MTU-N24, MTU-N25

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | k3s 내 모든 서비스(마이크로서비스, DB, 네트워크)를 통합 모니터링하여 장애 사전 예방 |
| 기술 | Prometheus + Grafana + Loki + Tempo + OTel Collector + Blackbox Exporter 완전 스택 |
| 규제 | CSAP D-06(감사 로그 모니터링), D-08(접근 통제 모니터링), D-12(PII 마스킹) |
| 운영 | 초급자도 따라할 수 있는 모니터링 사용자 가이드 + SQL/트래픽 특화 가이드 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 모니터링 인프라 코드는 있으나 사용자 가이드와 통합 대시보드 부재 |
| WHO | 플랫폼 관리자, DBA, DevOps 엔지니어 |
| RISK | OOM (모니터링 자체의 메모리 과다), 알림 폭주, 대시보드 과부하 |
| SUCCESS | 완전한 모니터링 스택 + 3종 사용자 가이드 (matchRate >= 90%) |
| SCOPE | kube-prometheus-stack 강화, 서비스별 대시보드, 사용자 가이드 3종 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 기준 |
|-------|---------|---------|----------|
| FR-N36.1 | kube-prometheus-stack 완전한 values.yaml | P0 | Helm 유효성 검증 통과 |
| FR-N36.2 | Loki 로그 수집 강화 | P0 | values.yaml 완전성 |
| FR-N36.3 | Tempo 분산 추적 강화 | P0 | values.yaml 완전성 |
| FR-N36.4 | OTel Collector 강화 | P1 | CRD 유효성 |
| FR-N36.5 | Grafana 대시보드 (서비스별) | P0 | JSON 유효성 |
| FR-N36.6 | Blackbox Exporter (외부 서비스 모니터링) | P1 | values.yaml 완전성 |
| FR-N36.7 | 원클릭 모니터링 설치 스크립트 강화 | P0 | 스크립트 실행 가능 |
| FR-N36.8 | 통합 모니터링 사용자 가이드 | P0 | 10개 이상 단계 |
| FR-N36.9 | SQL/DB 모니터링 특화 가이드 | P0 | 슬로우쿼리 + 인덱스 분석 포함 |
| FR-N36.10 | 트래픽 모니터링 가이드 | P0 | RED 메트릭 + 서비스 맵 포함 |

---

## 산출물 목록

| 산출물 | 경로 | 유형 |
|--------|------|------|
| kube-prometheus-stack values | `infra/monitoring/kube-prometheus-stack/values.yaml` | Helm values |
| Blackbox Exporter values | `infra/monitoring/blackbox-exporter/values.yaml` | Helm values |
| 서비스 RED 대시보드 | `infra/monitoring/dashboards/service-red-metrics.yaml` | ConfigMap |
| Node Exporter 대시보드 | `infra/monitoring/dashboards/node-exporter-detail.yaml` | ConfigMap |
| 원클릭 설치 스크립트 강화 | `scripts/setup-monitoring.sh` | Bash |
| 통합 모니터링 가이드 | `docs-portal/docs/monitoring/monitoring-user-guide.md` | Docusaurus MD |
| SQL 모니터링 가이드 | `docs-portal/docs/monitoring/sql-monitoring.md` | Docusaurus MD |
| 트래픽 모니터링 가이드 | `docs-portal/docs/monitoring/traffic-monitoring.md` | Docusaurus MD |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
