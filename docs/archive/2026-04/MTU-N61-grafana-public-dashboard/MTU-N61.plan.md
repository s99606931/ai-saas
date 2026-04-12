# MTU-N61: Grafana 공공기관 SaaS 특화 대시보드

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 감리 대응 실시간 대시보드, 테넌트별 리소스 관리, 보안 이벤트 시각화 |
| 기술 | Grafana JSON 대시보드 3종, MTU-N57 Recording Rules 활용, 변수 기반 동적 필터링 |
| 보안 | CSAP D-06 감사 이벤트 시각화, D-08 접근통제 위반 실시간 모니터링 |
| 운영 | 테넌트별 SLA 모니터링, 보안 사고 대응 대시보드 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 14개 대시보드는 범용 인프라 위주. 공공기관 SaaS 특화(CSAP, 테넌트, 보안) 부족 |
| WHO | 보안 담당자, 감리 위원, SRE 팀, 플랫폼 관리자 |
| RISK | 대시보드 쿼리 과다 시 성능 저하 |
| SUCCESS | 3개 신규 대시보드 생성, 한국어 전체 적용, Recording Rules 활용 |
| SCOPE | CSAP 준수 현황, 테넌트 리소스, 인증/보안 이벤트 대시보드 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N61.1 | CSAP 준수 현황 대시보드 | P0 | D-06 |
| FR-N61.2 | 테넌트별 리소스 사용량 대시보드 | P0 | D-08 |
| FR-N61.3 | 인증/보안 이벤트 대시보드 | P0 | D-08 |
| FR-N61.4 | Recording Rules 기반 쿼리 최적화 | P1 | D-06 |
| FR-N61.5 | 한국어 레이블/설명 전체 적용 | P0 | - |
| FR-N61.6 | 테스트 스크립트 | P0 | D-06 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| CSAP 준수 현황 대시보드 | `infra/monitoring/dashboards/csap-compliance-status.json` |
| 테넌트 리소스 대시보드 | `infra/monitoring/dashboards/tenant-resource-usage.json` |
| 인증 보안 대시보드 | `infra/monitoring/dashboards/security-auth-events.json` |
| 테스트 스크립트 | `scripts/test-grafana-dashboards.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
