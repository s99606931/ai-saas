# MTU-N144: 규정 준수 대시보드 종합 — Plan

> **문서 ID**: MTU-N144.plan
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead (claude-opus-4-6)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP 79개 통제항목 실시간 준수율 대시보드로 감리 대응 및 규정 준수 가시성 확보 |
| 기술 | Grafana 종합 대시보드 + CSAP 도메인별 준수율 Recording Rules + 알림 규칙 |
| 운영 | 경영진용 요약 뷰 + SRE용 상세 뷰 이중 구성, 실시간 준수율 자동 계산 |
| 규제 | CSAP D-01~D-13 전 도메인 커버리지, N2SF 6영역 매핑, ISMS-P 연계 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 csap-compliance-status.json이 Kyverno/Falco 일부만 커버. CSAP 79개 항목 전체 가시성 부재 |
| WHO | CISO, 감사인, SRE 팀, 경영진 |
| RISK | 감리 시 준수 현황 즉시 제시 불가, 규정 위반 미감지 |
| SUCCESS | CSAP 13개 도메인 x 준수율 실시간 표시, 도메인별 상세 드릴다운 |
| SCOPE | 종합 대시보드 JSON + 도메인별 준수율 Recording Rules + 미준수 알림 |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 기준 |
|-------|---------|---------|----------|
| FR-N144.1 | CSAP 13개 도메인 준수율 Recording Rules | P0 | D-01~D-13 각 도메인별 메트릭 |
| FR-N144.2 | 종합 규정 준수 대시보드 (경영진 뷰) | P0 | 전체 준수율 + 도메인별 게이지 |
| FR-N144.3 | 도메인별 상세 패널 (SRE 뷰) | P0 | 위반 항목 목록 + 트렌드 |
| FR-N144.4 | 준수율 하락 알림 규칙 | P1 | 도메인 준수율 < 90% 시 알림 |
| FR-N144.5 | N2SF 6영역 준수 현황 패널 | P1 | N2SF 매핑 포함 |

## 추적성 매트릭스

| FR ID | 산출물 | CSAP | 비고 |
|-------|--------|------|------|
| FR-N144.1 | infra/monitoring/csap-compliance-recording-rules.yaml | 전체 | 준수율 메트릭 |
| FR-N144.2 | infra/monitoring/dashboards/csap-compliance-comprehensive.json | 전체 | 경영진 뷰 |
| FR-N144.3 | csap-compliance-comprehensive.json 내 상세 패널 | 전체 | SRE 뷰 |
| FR-N144.4 | csap-compliance-recording-rules.yaml 내 알림 | 전체 | 하락 알림 |
| FR-N144.5 | csap-compliance-comprehensive.json 내 N2SF 패널 | 전체 | N2SF 매핑 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
