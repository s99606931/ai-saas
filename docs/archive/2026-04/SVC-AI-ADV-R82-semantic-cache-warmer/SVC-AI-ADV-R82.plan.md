# SVC-AI-ADV-R82 — Semantic Cache Warmer

> 2026-04-12 | v1.0.0 | PM Lead (9차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 빈번 쿼리 사전 캐시 → 첫 응답 지연 최소화 | p95 first-hit < 50ms |
| 기술 | 히트 기록 기반 후보 랭킹 + 사전 실행 + 우선순위 큐 | 예열 후 히트율 ≥ 70% |
| 보안 | C/S 등급 쿼리 예열 차단 + 마스킹 후 저장 | N2SF N-05 |
| 규정 | 예열 감사 추적 + 비용 상한 | CSAP D-06 |

## Context Anchor
- **WHY**: `semantic-cache.ts`는 수동 저장/조회 모듈. 공공기관 SaaS는 특정 업무 시나리오(민원 분류, FAQ, 문서 검색)에 반복되는 쿼리가 많고, 사전 예열로 첫 호출 지연을 낮출 수 있다. R82는 빈도·우선순위 기반 예열에 특화.
- **WHO**: AI 플랫폼팀, 운영팀, 비용 관리자
- **RISK**: 예열 비용 폭증, 오래된 쿼리 예열, PII 포함 쿼리 예열
- **SUCCESS**: 시드 쿼리 100개 중 상위 20개 예열 후 히트율 ≥ 70%, 예열 예산 초과 0건
- **SCOPE**:
  - IN — 히트 기록, 후보 랭킹, 실행자(executor) 주입, 배치 예열, 예산 상한
  - OUT — 실제 캐시 저장소(executor에 위임), LLM 호출(executor에 위임)

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R82.1 | 쿼리 히트 기록 + 등급 guard + PII 마스킹 | semantic-cache-warmer.ts |
| FR-R82.2 | 빈도·최신성 가중 점수 기반 후보 랭킹 | semantic-cache-warmer.ts |
| FR-R82.3 | 배치 예열 실행(executor 주입) + 우선순위 큐 | semantic-cache-warmer.ts |
| FR-R82.4 | 예산 상한(per warmup run) + 중단 | semantic-cache-warmer.ts |
| FR-R82.5 | getAuditLog + 이벤트(HIT/RANK/WARM/BUDGET_EXCEEDED) | semantic-cache-warmer.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R82.1 | semantic-cache-warmer.ts | semantic-cache-warmer.test.ts | N-05 |
| FR-R82.2 | semantic-cache-warmer.ts | semantic-cache-warmer.test.ts | - |
| FR-R82.3 | semantic-cache-warmer.ts | semantic-cache-warmer.test.ts | - |
| FR-R82.4 | semantic-cache-warmer.ts | semantic-cache-warmer.test.ts | - |
| FR-R82.5 | semantic-cache-warmer.ts | semantic-cache-warmer.test.ts | D-06 |
