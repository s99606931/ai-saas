# MTU-ISMS4 — ISMS-P 갱신 주기 관리 시스템

> **문서 ID**: MTU-ISMS4-PLAN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **참조**: docs/framework/03-isms-p/preparation-timeline.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | ISMS-P 3년 갱신 주기 관리, 인증 만료 방지 |
| **기술** | 갱신 체크리스트 + 자동 리마인더 + 연간 자가진단 절차 |
| **보안** | 갱신 누락 시 인증 실효 위험 방지 |
| **감리** | 갱신 프로세스 행안부 감리기준 추적성 확보 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | ISMS-P 인증은 3년 유효, 매년 사후심사 + 3년마다 갱신심사 필수 |
| **WHO** | CISO, 인증 담당자 |
| **RISK** | 갱신 기한 누락 시 인증 실효 -> 의무화 위반 -> 행정 제재 |
| **SUCCESS** | 3년 갱신 체크리스트 + 연간 사후심사 절차 + 리마인더 가이드 완비 |
| **SCOPE** | 갱신 주기 체크리스트, 사후심사 절차, 자동 리마인더 설정 가이드 |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-ISMS4.1 | 3년 갱신 주기 체크리스트 (갱신 D-180 ~ D-Day 일정) | MUST | 문서 존재 + 주요 마일스톤 포함 |
| FR-ISMS4.2 | 연간 사후심사 준비 절차서 | MUST | 문서 존재 + 연간 일정 포함 |
| FR-ISMS4.3 | 자동 리마인더 설정 가이드 (Gitea Issue + 캘린더 연동) | MUST | 가이드 존재 |
| FR-ISMS4.4 | 관리체계 변경사항 추적 절차 (인증 범위 변경 시 신고) | SHOULD | 변경 신고 절차 명시 |
| FR-ISMS4.5 | 갱신 비용 및 일정 산정 가이드 | SHOULD | 문서 존재 |

## 산출물

| 산출물 | 경로 | 형식 |
|--------|------|------|
| 갱신 주기 체크리스트 | `docs/framework/03-isms-p/renewal/renewal-checklist.md` | Markdown |
| 사후심사 절차서 | `docs/framework/03-isms-p/renewal/annual-surveillance-procedure.md` | Markdown |
| 리마인더 설정 가이드 | `docs/framework/03-isms-p/renewal/reminder-setup-guide.md` | Markdown |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
