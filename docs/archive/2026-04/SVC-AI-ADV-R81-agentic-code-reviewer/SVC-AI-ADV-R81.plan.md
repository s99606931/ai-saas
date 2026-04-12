# SVC-AI-ADV-R81 — Agentic Code Reviewer

> 2026-04-12 | v1.0.0 | PM Lead (9차 세션 — R81~R85)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | AI 기반 다단계 코드 리뷰 자동화 → PR 품질 게이트 | 이슈 검출률 ≥ 85% |
| 기술 | 설계→취약→품질→CSAP 체크 4단계 에이전트 파이프라인 | 리뷰 p95 < 2s (모의) |
| 보안 | PR 패치에 시크릿/SQL 주입/평문 암호 탐지 | CSAP D-12 |
| 규정 | 리뷰 감사 추적 + 차단 결정 기록 | CSAP D-06 |

## Context Anchor
- **WHY**: 단일 규칙 기반 정적 분석(`code-review-ai.ts`)을 넘어, PR 패치에 대해 설계 의도→취약점→품질→CSAP 준수 4단계로 순차 판단하는 agentic 파이프라인이 필요. R81은 다단계 의사결정 + 단계별 근거 기록에 특화.
- **WHO**: 개발자(PR 저자), 리뷰어, 보안팀, 감사팀
- **RISK**: LLM 환각으로 오탐지, PR 내용 유출, 차단 기준 불투명
- **SUCCESS**: 시드 패치 10건 중 알려진 이슈 8건 이상 검출, 각 단계 근거(rationale) 기록, C/S 등급 PR 차단
- **SCOPE**:
  - IN — 패치 분할(헝크), 단계 실행자 주입, 단계별 판정, 종합 판결(allow/warn/block), 감사 로그
  - OUT — 실제 LLM 호출(executor 주입), PR 시스템 연동

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R81.1 | 패치(diff hunk) 수집 + 등급 guard + 시크릿 패턴 선차단 | agentic-code-reviewer.ts |
| FR-R81.2 | 4단계 파이프라인(design→security→quality→compliance) 순차 실행 | agentic-code-reviewer.ts |
| FR-R81.3 | 단계별 판정(pass/warn/fail) + 근거(rationale) 저장 | agentic-code-reviewer.ts |
| FR-R81.4 | 종합 판결(allow/warn/block) + CSAP 체크 실패 시 자동 차단 | agentic-code-reviewer.ts |
| FR-R81.5 | getAuditLog + 이벤트(REVIEW/STEP/BLOCKED/ALLOWED/WARN) | agentic-code-reviewer.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R81.1 | agentic-code-reviewer.ts | agentic-code-reviewer.test.ts | D-12, N-05 |
| FR-R81.2 | agentic-code-reviewer.ts | agentic-code-reviewer.test.ts | - |
| FR-R81.3 | agentic-code-reviewer.ts | agentic-code-reviewer.test.ts | - |
| FR-R81.4 | agentic-code-reviewer.ts | agentic-code-reviewer.test.ts | D-12 |
| FR-R81.5 | agentic-code-reviewer.ts | agentic-code-reviewer.test.ts | D-06 |
