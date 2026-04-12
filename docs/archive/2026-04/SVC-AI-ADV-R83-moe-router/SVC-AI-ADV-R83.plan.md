# SVC-AI-ADV-R83 — Mixture of Experts (MoE) 라우터

> v1.0.0 | 2026-04-12 | PM Lead (5차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 도메인별 최적 전문가 모델 자동 선택 | 품질 +15% |
| 기술 | 키워드/점수 기반 경량 라우팅 | 선택 p95 < 3ms |
| 보안 | 등급 guard + 감사 | CSAP D-06 |
| 품질 | top-k 전문가 혼합 지원 | 결정적 |

## Context Anchor
- **WHY**: 법령/코드/일반 등 질의 성격이 다른데 단일 범용 모델은 도메인 정확도가 낮다. 입력 복잡도·도메인을 간단히 분류해 전문가 모델 혹은 상위 k개 전문가를 선택해야 한다.
- **WHO**: AI Gateway, RAG 파이프라인, 챗봇
- **RISK**: 오분류로 잘못된 전문가 선택, 분류 지연
- **SUCCESS**: 도메인 분류 정확도 ≥ 90%, 선택 지연 ≤ 3ms
- **SCOPE**: IN — 전문가 등록, 점수 산출, top-k 선택, 감사 / OUT — 실제 추론 호출

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R83.1 | 전문가 등록 (id/도메인/키워드/비용) | moe-router.ts |
| FR-R83.2 | 입력 점수 산출 (키워드 가중치 + 복잡도) | 동일 |
| FR-R83.3 | top-k 전문가 선택 + 가중치 반환 | 동일 |
| FR-R83.4 | 분류 불가 시 default 전문가 폴백 | 동일 |
| FR-R83.5 | getAuditLog + REGISTER/SCORE/SELECT/FALLBACK | 동일 |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| R83.1~4 | moe-router.ts | moe-router.test.ts | - |
| R83.5 | 동일 | 동일 | D-06 |
