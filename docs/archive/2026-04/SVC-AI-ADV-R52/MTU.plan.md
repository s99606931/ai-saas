# SVC-AI-ADV-R52 — Adaptive Retrieval Strategy

> 2026-04-12 | v1.0.0 | 작성자: PM Lead

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | 쿼리 복잡도에 맞는 검색 전략 자동 선택으로 정확도 25% 향상 |
| 기술 | 단순/복합/multi-hop 쿼리 분류 → BM25/dense/hybrid/multi-hop 라우팅 |
| 보안 | 데이터 등급별 검색 범위 제한 |
| 규정 | CSAP D-12, D-08 (인덱스 접근 통제) |

## Context Anchor
- **WHY**: 단순 사실 질문에는 BM25가 빠르고 정확. 의미 매칭에는 dense 임베딩. 복잡 추론에는 multi-hop 필요. 모든 쿼리에 동일 전략 적용은 비효율.
- **WHO**: RAG 운영팀, 검색 엔지니어
- **RISK**: 분류 오류 → 폴백 전략으로 dense 사용
- **SUCCESS**: top-5 정확도 25% 향상, 평균 지연 30% 감소
- **SCOPE**: 쿼리 분류기, 전략 라우터, 다전략 실행

## FR
| FR | 산출물 |
|---|---|
| FR-R52.1 쿼리 복잡도 분류 | `adaptive-retrieval-strategy.ts::classifyQuery` |
| FR-R52.2 전략 선택 (BM25/dense/hybrid/multi-hop) | `adaptive-retrieval-strategy.ts::selectStrategy` |
| FR-R52.3 전략 실행 (전략별 retriever 호출) | `adaptive-retrieval-strategy.ts::retrieve` |
| FR-R52.4 분류 confidence 낮을 시 hybrid 폴백 | `adaptive-retrieval-strategy.ts::fallback` |
| FR-R52.5 전략별 통계 (사용 횟수, 정확도) | `adaptive-retrieval-strategy.ts::stats` |
| FR-R52.6 감사 로그 | `adaptive-retrieval-strategy.ts::audit` |

## NFR
- 분류 시간 < 5ms
- TS strict 통과

## 추적성
| FR | 산출물 | 테스트 |
|---|---|---|
| FR-R52.1~6 | adaptive-retrieval-strategy.ts | 단위 테스트 |

## 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
