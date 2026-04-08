# MTU-ISMS3 — CSAP-ISMS-P 중복 매핑 통합 증적

> **문서 ID**: MTU-ISMS3-PLAN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **참조**: docs/framework/03-isms-p/csap-isms-mapping.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | CSAP-ISMS-P 45항목 중복 증적 통합으로 심사 준비 40% 공수 절감 |
| **기술** | 기존 csap-isms-mapping.md 확장 + 통합 증적 패키지 구성 |
| **보안** | 증적 무결성 보장 (해시 검증 + append-only 로그) |
| **감리** | 추적성 매트릭스: CSAP ID <-> ISMS-P ID <-> 증적 경로 4방향 추적 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | CSAP 79항목 중 45항목(36 완전 + 9 부분)이 ISMS-P와 중복, 통합 관리로 효율화 |
| **WHO** | CISO, 인증 담당자, 심사원 |
| **RISK** | 증적 불일치 시 양쪽 심사 모두 결함 판정 가능 |
| **SUCCESS** | 통합 증적 패키지 1개로 CSAP + ISMS-P 동시 대응 가능 |
| **SCOPE** | 45항목 통합 매핑 상세화 + 통합 증적 제출 패키지 가이드 |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-ISMS3.1 | 완전 중복 36항목 통합 증적 상세표 (증적 경로 + 제출 형태) | MUST | 36항목 전수 증적 경로 존재 |
| FR-ISMS3.2 | 부분 중복 9항목 보완 계획서 (추가 필요 증적 목록) | MUST | 9항목 전수 보완 항목 명시 |
| FR-ISMS3.3 | 통합 증적 제출 패키지 구성 가이드 | MUST | 패키지 디렉토리 구조 정의 |
| FR-ISMS3.4 | 증적 버전 관리 규칙 (CSAP/ISMS-P 동시 업데이트 절차) | SHOULD | 절차서 존재 |
| FR-ISMS3.5 | 심사원별 증적 뷰 (CSAP용/ISMS-P용 분리 제출 가이드) | SHOULD | 분리 제출 매핑표 존재 |

## 산출물

| 산출물 | 경로 | 형식 |
|--------|------|------|
| 통합 증적 상세 매핑 | `docs/framework/03-isms-p/integrated-evidence/detailed-mapping.md` | Markdown |
| 통합 증적 패키지 가이드 | `docs/framework/03-isms-p/integrated-evidence/package-guide.md` | Markdown |
| 부분 중복 보완 계획서 | `docs/framework/03-isms-p/integrated-evidence/partial-supplement-plan.md` | Markdown |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
