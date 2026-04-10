# MTU-N238: Falco 런타임 보안 이벤트 모니터링 — Plan

> **문서 ID**: MTU-N238-PLAN
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **Phase**: Round 25 — 보안 이벤트 관측성

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 런타임 보안 위협 탐지 메트릭으로 CSAP 침해 대응 역량 증명 |
| 기술 | Falco 이벤트 발생률, 심각도 분포, 규칙별 트리거, Falcosidekick 전달 성능 수집 |
| 보안 | CSAP D-06 침해사고 관리, D-12 시스템 보안 — 런타임 위협 탐지 SLI |
| 운영 | 위험 이벤트 실시간 알림, 노이즈 비율 추적, 대응 시간 시각화 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Falco가 런타임 위협을 탐지하지만, 탐지 자체의 가용성/성능을 모니터링하지 않으면 보안 사각지대 발생 |
| WHO | 보안 관리자, SRE 팀, SOC 팀, 감리원 |
| RISK | Falco 서비스 장애 → 런타임 위협 미탐지 → CSAP D-06 미충족 |
| SUCCESS | Falco 메트릭 4종 + 알림 5개 + 대시보드 1개 + 검증 스크립트 |
| SCOPE | Falco 이벤트 메트릭, Falcosidekick 전달 성능, 규칙 트리거 분석 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N238.1 | Falco 이벤트 발생률 (심각도별) 수집 | HIGH |
| FR-N238.2 | 규칙별 이벤트 트리거 빈도 수집 | HIGH |
| FR-N238.3 | Falcosidekick 이벤트 전달 성능 (성공/실패, 지연) 수집 | HIGH |
| FR-N238.4 | Falco 드롭 이벤트(syscall 수집 실패) 비율 수집 | HIGH |
| FR-N238.5 | Falco 서비스 리소스 사용량 추적 | MED |
| FR-N238.6 | 런타임 보안 알림 규칙 5개 | HIGH |
| FR-N238.7 | Grafana 대시보드 구성 | HIGH |
| FR-N238.8 | 검증 스크립트 작성 | HIGH |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 산출물 |
|-------|-----------|-----------|
| FR-N238.1 | §3.1 | falco-performance-rules.yaml |
| FR-N238.2 | §3.1 | falco-performance-rules.yaml |
| FR-N238.3 | §3.2 | falco-performance-rules.yaml |
| FR-N238.4 | §3.3 | falco-performance-rules.yaml |
| FR-N238.5 | §3.4 | falco-performance-rules.yaml |
| FR-N238.6 | §3.5 | falco-performance-alerts.yaml |
| FR-N238.7 | §3.6 | dashboards/falco-runtime-security.json |
| FR-N238.8 | §3.7 | verify-falco-monitoring.sh |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
