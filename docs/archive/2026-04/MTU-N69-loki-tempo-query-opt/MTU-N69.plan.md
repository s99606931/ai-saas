# MTU-N69: Loki LogQL + Tempo TraceQL 고급 쿼리 최적화

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 로그/트레이스 분석 효율화, 장애 원인 분석 시간 단축, 감리 대응 |
| 기술 | LogQL 패턴 10종, TraceQL 패턴 8종, Loki alerting rules |
| 보안 | CSAP D-06 감사 로그 쿼리, D-08 접근 실패 추적, PII 필터링 |
| 운영 | 장애 대응 Runbook 연동, 쿼리 가이드 문서화 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N69.1 | LogQL 기본 쿼리 패턴 10종 (운영 가이드) | P0 | D-06 |
| FR-N69.2 | TraceQL 기본 쿼리 패턴 8종 (운영 가이드) | P0 | D-06 |
| FR-N69.3 | Loki alerting rules (로그 기반 알림) | P1 | D-06 |
| FR-N69.4 | 로그-트레이스 상관관계 쿼리 가이드 | P0 | D-06 |
| FR-N69.5 | 테스트 스크립트 | P0 | D-06 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| LogQL/TraceQL 가이드 | `docs/operations/logql-traceql-query-guide.md` |
| Loki 알림 규칙 | `infra/monitoring/loki-alerting-rules.yaml` |
| 테스트 스크립트 | `scripts/test-logql-traceql.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
