# SVC-AI-ADV-R68 — Eval Harness v2 (RAGAS 기반)

> 2026-04-12 | v1.0.0 | PM Lead (4차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | AI 모델/프롬프트 변경 시 회귀 방지 | 매 릴리스 자동 벤치 |
| 기술 | RAGAS 지표 + 자동 벤치 + 회귀 판정 | 지표 6종 자동 산출 |
| 보안 | 평가 데이터 O등급 고정 | N2SF N-05 |
| 규정 | 평가 이력 감사 로그 | 100% |

## Context Anchor
- **WHY**: 수동 평가는 재현성과 일관성이 떨어져 공공 서비스 품질 보증이 어려움. RAGAS 스타일 자동 벤치마크가 필요.
- **WHO**: AI 엔지니어, QA, 감리
- **RISK**: 오탐 지표, 평가 데이터 등급 위반
- **SUCCESS**: 6개 지표 자동 산출, 기준선(baseline) 대비 회귀 판정
- **SCOPE**: IN — 데이터셋 등록/평가 실행/지표 계산/회귀 판정/리포트 / OUT — 외부 LLM 심판 호출

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R68.1 | 데이터셋 등록 + 등급 검증 | eval-harness-v2.ts |
| FR-R68.2 | 지표 6종 (faithfulness, answer-relevance, context-precision, context-recall, similarity, groundedness) | eval-harness-v2.ts |
| FR-R68.3 | 벤치 실행 + 스코어 집계 | eval-harness-v2.ts |
| FR-R68.4 | baseline 비교 + 회귀 판정 | eval-harness-v2.ts |
| FR-R68.5 | getAuditLog + 리포트 요약 | eval-harness-v2.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R68.1 | eval-harness-v2.ts | eval-harness-v2.test.ts | N-05 |
| FR-R68.2 | eval-harness-v2.ts | eval-harness-v2.test.ts | - |
| FR-R68.3 | eval-harness-v2.ts | eval-harness-v2.test.ts | - |
| FR-R68.4 | eval-harness-v2.ts | eval-harness-v2.test.ts | - |
| FR-R68.5 | eval-harness-v2.ts | eval-harness-v2.test.ts | D-06 |
