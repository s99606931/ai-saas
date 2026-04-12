# SVC-AI-ADV-R53 — Self-Correction Loop (Reflexion)

> 2026-04-12 | v1.0.0 | 작성자: PM Lead

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | AI 응답 환각 30% 감소, 정확도 15% 향상 |
| 기술 | 응답 → 자기 비평 → 수정 루프 (Reflexion 패턴) |
| 보안 | 비평/수정 단계도 N2SF O등급만 처리 |
| 규정 | CSAP D-12, D-06 (수정 이력 감사) |

## Context Anchor
- **WHY**: 단일 LLM 호출 응답은 환각·논리 오류 가능. 자기 비평 후 재생성으로 품질 개선.
- **WHO**: 행정 AI 응답 품질 관리, 자동 검토 시스템
- **RISK**: 무한 루프 → 최대 반복 횟수 강제
- **SUCCESS**: 최종 응답의 환각 점수 30% 감소, 평균 반복 < 3회
- **SCOPE**: 비평 생성, 수정 적용, 수렴 판단, 반복 제한

## FR
| FR | 산출물 |
|---|---|
| FR-R53.1 응답 비평 (critique) | `self-correction-loop.ts::critique` |
| FR-R53.2 수정 적용 (revise) | `self-correction-loop.ts::revise` |
| FR-R53.3 수렴 판단 (issue 0개) | `self-correction-loop.ts::hasConverged` |
| FR-R53.4 최대 반복 제한 (기본 5) | `self-correction-loop.ts::run` |
| FR-R53.5 수정 이력 추적 | `self-correction-loop.ts::history` |
| FR-R53.6 감사 로그 | `self-correction-loop.ts::audit` |

## NFR
- 단일 사이클 < 5s
- TS strict 통과

## 추적성
| FR | 산출물 | 테스트 |
|---|---|---|
| FR-R53.1~6 | self-correction-loop.ts | 단위 테스트 |

## 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
