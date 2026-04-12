# MTU-N229: Loki 로그 수집 파이프라인 모니터링 — Plan

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **작성자**: PM 에이전트
> **상태**: 승인됨

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Loki 기반 로그 파이프라인의 수집 지연, 드롭, 수집률 이상을 실시간 감지하여 장애 선제 대응 |
| 기술 | Promtail→Loki 파이프라인의 수집률, 지연, 드롭률, 압축 효율, 스토리지 사용량 메트릭 기반 모니터링 |
| 보안 | CSAP D-06 로그 무결성 보장: 로그 누락 탐지, PII 마스킹 파이프라인 정상 동작 확인 |
| 운영 | SLO: 로그 수집 지연 p99 < 5초, 드롭률 < 0.1%, 로그 파이프라인 가용성 99.9% |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Loki 로그 파이프라인은 CSAP D-06 감사 로깅의 핵심. 수집 장애 시 보안 사고 감지 불가. 파이프라인 상태 모니터링으로 사전 탐지 필수 |
| WHO | SRE, DevOps, 보안 관리자 |
| RISK | 로그 누락 시 CSAP D-06 위반, 보안 사고 미탐지, 감사 증적 부재 |
| SUCCESS | 수집 지연/드롭 알림 즉시 발생, 파이프라인 이상 5분 이내 탐지 |
| SCOPE | Promtail→Loki 로그 파이프라인 전 구간 모니터링 |

---

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N229.1 | Loki ingester 수집률/드롭률 메트릭 수집 | PrometheusRule 규칙 정의 확인 |
| FR-N229.2 | Promtail 수집 에이전트 상태 모니터링 (지연, 실패) | 알림 규칙 정의 확인 |
| FR-N229.3 | Loki 스토리지 사용량 및 압축 효율 추적 | Recording Rule 정의 확인 |
| FR-N229.4 | Loki 쿼리 성능 모니터링 (지연, 타임아웃) | 알림 규칙 정의 확인 |
| FR-N229.5 | Grafana 대시보드: 로그 파이프라인 전체 현황 | 대시보드 JSON 생성 확인 |
| FR-N229.6 | 통합 알림: Loki/Promtail 장애 시 AlertManager 전달 | 알림 규칙 severity 분류 확인 |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N229.1 | 메트릭 수집 주기 15초 | Prometheus scrape interval |
| NFR-N229.2 | 알림 발생 지연 5분 이내 | for 절 최대 5m |
| NFR-N229.3 | WSL2 환경 리소스 부하 최소화 | 추가 Recording Rule 10개 이하 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Plan 문서 | `docs/01-plan/mtus/MTU-N229-loki-log-pipeline.plan.md` |
| Design 문서 | `docs/02-design/mtus/MTU-N229-loki-log-pipeline.design.md` |
| Recording Rules | `infra/monitoring/loki-pipeline-rules.yaml` |
| Alert Rules | `infra/monitoring/loki-pipeline-alerts.yaml` |
| Grafana 대시보드 | `infra/monitoring/dashboards/loki-pipeline-dashboard.json` |
| 검증 스크립트 | `scripts/test-loki-pipeline-monitoring.sh` |
| Report | `docs/04-report/MTU-N229.report.md` |

---

## 추적성 매트릭스

| FR ID | Design | 구현 파일 | 테스트 | CSAP |
|-------|--------|----------|--------|------|
| FR-N229.1 | §1.1 | loki-pipeline-rules.yaml | 스크립트 TC1 | D-06 |
| FR-N229.2 | §1.2 | loki-pipeline-alerts.yaml | 스크립트 TC2 | D-06 |
| FR-N229.3 | §1.3 | loki-pipeline-rules.yaml | 스크립트 TC3 | D-06 |
| FR-N229.4 | §1.4 | loki-pipeline-alerts.yaml | 스크립트 TC4 | D-06 |
| FR-N229.5 | §1.5 | loki-pipeline-dashboard.json | 스크립트 TC5 | D-06 |
| FR-N229.6 | §1.6 | loki-pipeline-alerts.yaml | 스크립트 TC6 | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
