# MTU-N92: AI 기반 이상 탐지 (Adaptive Alerting) — Plan

> **Phase**: 모니터링 Round 7 — 심화 최적화
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 정적 임계값 대신 동적 이상 탐지로 장애 조기 발견율 향상 |
| 기술 | Z-Score 기반 PromQL 이상 탐지 + 적응형 임계값 자동 조정 |
| 운영 | 수동 임계값 관리 부담 제거, 트래픽 패턴 변화에 자동 적응 |
| 보안 | 비정상 트래픽 패턴 자동 감지로 보안 사고 조기 탐지 (CSAP D-06) |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 정적 임계값은 트래픽 변동에 대응 불가, 오탐/누락 빈발 |
| WHO | SRE 팀, 보안 팀 |
| RISK | Z-Score 감도 조절 실패 시 알림 폭주 → 보수적 임계값(3 sigma)부터 시작 |
| SUCCESS | matchRate >= 90%, Z-Score 기반 규칙 6개 이상, 적응형 임계값 작동 |
| SCOPE | PromQL Z-Score 규칙, 적응형 알림 규칙, Grafana 이상 탐지 대시보드 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N92.1 | Z-Score 기반 서비스 요청률 이상 탐지 | HIGH |
| FR-N92.2 | Z-Score 기반 응답 지연 이상 탐지 | HIGH |
| FR-N92.3 | Z-Score 기반 에러율 이상 탐지 | HIGH |
| FR-N92.4 | 적응형 임계값 Recording Rules (이동 평균 + 표준편차) | HIGH |
| FR-N92.5 | 이상 탐지 대시보드 (Z-Score 시각화) | MED |
| FR-N92.6 | 시스템 리소스 이상 탐지 (CPU, Memory, Disk) | MED |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
