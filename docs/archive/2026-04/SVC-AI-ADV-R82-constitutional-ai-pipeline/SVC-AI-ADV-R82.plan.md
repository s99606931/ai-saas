# SVC-AI-ADV-R82 — Constitutional AI 자기 교정 파이프라인

> v1.0.0 | 2026-04-12 | PM Lead (5차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 공공기관 윤리/무해성 원칙 100% 준수 AI 응답 | 위반율 ≤ 0.1% |
| 기술 | 헌법 원칙 기반 Critique→Revise 루프 | 평균 iter ≤ 3 |
| 보안 | 등급 guard + 감사 | CSAP D-06, D-12 |
| 규정 | 금칙어/차별 표현/정치적 편향 0건 | ISMS-P |

## Context Anchor
- **WHY**: 공공기관 AI 응답은 행정 중립·무해·차별 금지 원칙을 엄격히 준수해야 한다. 단순 Reflexion(R53)과 달리 **헌법(Constitution)** — 명시된 원칙 목록 — 으로 자동 비평·수정하는 Constitutional AI 파이프라인이 필요.
- **WHO**: 민원 챗봇, AI 보고서 생성, 정책 설명 도우미
- **RISK**: 과도 필터링으로 유용성 저하, 원칙 충돌
- **SUCCESS**: 원칙 위반 탐지율 ≥ 98%, 응답 유용성 유지
- **SCOPE**: IN — 원칙 등록/비평/수정/수렴/감사 / OUT — 실제 LLM (주입형)

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R82.1 | 헌법 원칙 등록 (id/설명/심각도) | constitutional-ai-pipeline.ts |
| FR-R82.2 | 응답 비평 (원칙별 위반 판정) | 동일 |
| FR-R82.3 | 수정 생성 + 최대 iter (기본 3) 루프 | 동일 |
| FR-R82.4 | 수렴 판정 (모든 원칙 통과 or iter 초과) | 동일 |
| FR-R82.5 | getAuditLog + CREATE/CRITIQUE/REVISE/CONVERGED/FAILED | 동일 |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| R82.1~4 | constitutional-ai-pipeline.ts | constitutional-ai-pipeline.test.ts | D-12 |
| R82.5 | 동일 | 동일 | D-06 |
