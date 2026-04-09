# MTU-N48: Grafana Tempo 분산 추적 고도화 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 관측성 3대 축(메트릭+로그+트레이스) 완성으로 장애 대응 시간 단축 |
| 기술 | Grafana Tempo + OpenTelemetry Collector 통합 분산 추적 |
| 보안 | 트레이스 데이터 감사 추적 (CSAP D-06), PII 필터링 |
| 운영 | Grafana 통합 대시보드에서 메트릭→로그→트레이스 상호 연결 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N48.1 | Tempo Helm values 고도화 (스토리지 최적화, 보존 정책) | 필수 |
| FR-N48.2 | OTel Collector 파이프라인 강화 (trace→metric 변환) | 필수 |
| FR-N48.3 | Grafana 데이터소스 Tempo 연동 강화 | 필수 |
| FR-N48.4 | 서비스맵 + TraceQL 예시 대시보드 | 필수 |
| FR-N48.5 | trace-to-log, trace-to-metric 상호 연결 설정 | 필수 |
| FR-N48.6 | PII 필터링 프로세서 (N2SF 준수) | 필수 |
| FR-N48.7 | 테스트 스크립트 | 필수 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Tempo values 고도화 | `infra/monitoring/tempo/values.yaml` (수정) |
| OTel Collector 설정 | `infra/monitoring/otel-collector-traces.yaml` |
| Grafana 대시보드 | `infra/monitoring/dashboards/distributed-tracing.json` |
| TraceQL 쿼리 예시 | `docs/operations/traceql-examples.md` |
| 테스트 스크립트 | `scripts/test-distributed-tracing.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
