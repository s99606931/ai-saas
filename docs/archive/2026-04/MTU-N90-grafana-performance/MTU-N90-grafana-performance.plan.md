# MTU-N90: Grafana 대시보드 성능 최적화 — Plan

> **Phase**: 모니터링 Round 7 — 심화 최적화
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 대시보드 로드 시간 50% 단축, 감리 수검 시 실시간 현황 즉시 제공 |
| 기술 | Recording Rules 확장, 쿼리 캐싱, 대시보드 변수 최적화 |
| 운영 | 대시보드 표준화 + 프로비저닝 자동화로 운영 부담 감소 |
| 보안 | Grafana 접근통제 + 대시보드 편집 제한으로 무단 변경 방지 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 대시보드 24개 누적으로 로드 지연 발생, PromQL 쿼리 비효율 |
| WHO | SRE 팀, 개발팀, 감리원 |
| RISK | 과도한 캐싱 시 실시간 알림 지연 → 캐시 TTL 30초 이하로 제한 |
| SUCCESS | matchRate >= 90%, 대시보드 로드 < 3초, 쿼리 응답 < 1초 |
| SCOPE | Recording Rules 추가, Grafana 캐싱 설정, 대시보드 최적화 가이드 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|----------|
| FR-N90.1 | 고빈도 대시보드 쿼리 Recording Rules 변환 | HIGH | recording-rules.yaml 검증 |
| FR-N90.2 | Grafana 쿼리 캐싱 최적화 (30초 TTL) | HIGH | grafana.ini 설정 확인 |
| FR-N90.3 | 대시보드 변수 쿼리 최적화 (label_values → metric 기반) | MED | 대시보드 JSON 확인 |
| FR-N90.4 | 대시보드 패널 범위 제한 (기본 1시간, 최대 7일) | MED | 대시보드 설정 확인 |
| FR-N90.5 | Grafana 성능 튜닝 구성 (concurrent queries, query timeout) | HIGH | values.yaml 확인 |
| FR-N90.6 | 대시보드 성능 최적화 가이드 문서 | MED | 가이드 문서 검증 |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| 확장 Recording Rules | `infra/monitoring/grafana-optimized-recording-rules.yaml` | YAML |
| Grafana 성능 튜닝 패치 | `infra/monitoring/kube-prometheus-stack/values.yaml` (수정) | YAML |
| 최적화 대시보드 | `infra/monitoring/dashboards/optimized-overview.json` | JSON |
| 성능 최적화 가이드 | `docs/operations/grafana-performance-guide.md` | Markdown |
| 검증 스크립트 | `scripts/test-grafana-performance.sh` | Bash |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
