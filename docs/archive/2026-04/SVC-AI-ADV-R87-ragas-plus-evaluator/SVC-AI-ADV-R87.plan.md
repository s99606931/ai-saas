# SVC-AI-ADV-R87 — RAGAS++ 평가 자동화

> v1.0.0 | 2026-04-12 | PM Lead (5차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | RAG 품질 회귀 방지 | 품질 저하 감지율 ≥ 95% |
| 기술 | 휴리스틱 4지표 + 골든셋 비교 | 평가 p95 < 50ms |
| 보안 | 등급 guard | N2SF N-05 |
| 규정 | 회귀 감사 | CSAP D-06 |

## Context Anchor
- **WHY**: 기존 `rag-evaluator.ts`는 LLM 호출 기반이라 비용·지연 높음. CI 파이프라인에 적합한 **경량 휴리스틱 평가** + **골든셋 회귀 감지** 필요.
- **WHO**: CI/CD, QA, 플랫폼팀
- **RISK**: 휴리스틱 한계로 질적 평가 누락 → LLM 평가와 병행 사용 권고
- **SUCCESS**: 평가 지연 50ms↓, 회귀 감지율 95%↑
- **SCOPE**: IN — Context Precision/Recall/Faithfulness/Answer Relevancy(휴리스틱) + 골든셋 / OUT — LLM 호출

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R87.1 | 골든셋 등록 (question, answer, contexts) | ragas-plus-evaluator.ts |
| FR-R87.2 | 4지표 휴리스틱 계산 | 동일 |
| FR-R87.3 | 배치 평가 + 평균 리포트 | 동일 |
| FR-R87.4 | 베이스라인 대비 회귀 탐지 (임계값) | 동일 |
| FR-R87.5 | getAuditLog + ADD/EVAL/REGRESSION | 동일 |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| R87.1~4 | ragas-plus-evaluator.ts | ragas-plus-evaluator.test.ts | - |
| R87.5 | 동일 | 동일 | D-06 |
