# MTU-ISMS2 — ISMS-P 심사 준비 문서

> **문서 ID**: MTU-ISMS2-PLAN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **참조**: docs/framework/03-isms-p/preparation-timeline.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | ISMS-P 2027-07 의무화 대응, 인증기관 심사 신청 절차 표준화 |
| **기술** | 인증기관 선정 기준 + 심사 일정 템플릿 + 심사원 Q&A 가이드 |
| **보안** | 심사 과정 증적 보안 (N2SF O등급 범위 내) |
| **감리** | 심사 준비 산출물 행안부 감리기준 준수 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | ISMS-P 의무화(2027-07) 대응을 위한 인증기관 심사 신청 준비 표준화 |
| **WHO** | CISO, 보안 담당자, 개발팀 리더 |
| **RISK** | 심사 신청 누락/지연 시 의무화 데드라인 미준수, 행정 제재 |
| **SUCCESS** | 심사 준비 문서 3종 완비 + 인증기관 신청 절차 표준화 |
| **SCOPE** | 인증기관 선정 가이드, 심사 일정 템플릿, 심사원 대응 Q&A |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-ISMS2.1 | 인증기관 선정 가이드 (KISA 인증 심사기관 목록 + 선정 기준) | MUST | 문서 존재 + 3개 이상 기관 비교 |
| FR-ISMS2.2 | 심사 일정 템플릿 (D-90 ~ D+30 타임라인) | MUST | 문서 존재 + 주요 마일스톤 포함 |
| FR-ISMS2.3 | 심사원 대응 Q&A 가이드 (101항목별 예상 질문/답변) | MUST | 문서 존재 + 최소 50개 Q&A |
| FR-ISMS2.4 | 심사 비용 산정 가이드 (규모별 예상 비용표) | SHOULD | 문서 존재 |
| FR-ISMS2.5 | 심사 증적 제출 체크리스트 (서류 심사용) | MUST | 문서 존재 + 101항목 커버리지 |

## 산출물

| 산출물 | 경로 | 형식 |
|--------|------|------|
| 인증기관 신청 가이드 | `docs/framework/03-isms-p/certification-prep/agency-selection-guide.md` | Markdown |
| 심사 일정 템플릿 | `docs/framework/03-isms-p/certification-prep/audit-schedule-template.md` | Markdown |
| 심사원 대응 Q&A | `docs/framework/03-isms-p/certification-prep/auditor-qa-guide.md` | Markdown |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
