# SVC-AI-ADV-R74 — Contextual Memory Manager

> 2026-04-12 | v1.0.0 | PM Lead (7차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 에이전트 세션 간 맥락 보존 | 재질의율 -30% |
| 기술 | 슬롯/요약/TTL/우선순위 관리 | 조회 p95 < 5ms |
| 보안 | 등급별 메모리 분리 + 만료 | N2SF N-05 |
| 규정 | 메모리 변경 감사 + 보존 1년 | CSAP D-06 |

## Context Anchor
- **WHY**: 기존 `agent-memory.ts`, `conversation-memory.ts`는 단일 세션 중심. 본 MTU는 에이전트·사용자·테넌트 3축의 장기 맥락 관리(슬롯/요약/TTL/우선순위)를 담당.
- **WHO**: 챗봇, 민원 대응, RAG 에이전트
- **RISK**: C/S 등급 누설, 만료 누락, 메모리 포화
- **SUCCESS**: TTL 적용률 100%, 등급 분리 100%
- **SCOPE**: IN — 저장/요약/조회/TTL/우선순위 eviction / OUT — 외부 벡터 DB

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R74.1 | 메모리 엔트리 저장 + 등급 guard | contextual-memory-manager.ts |
| FR-R74.2 | TTL + 우선순위 + LRU eviction | contextual-memory-manager.ts |
| FR-R74.3 | 세션 요약(summary) 생성/저장 | contextual-memory-manager.ts |
| FR-R74.4 | 축(agent/user/tenant)별 조회 | contextual-memory-manager.ts |
| FR-R74.5 | getAuditLog + 만료/용량 리포트 | contextual-memory-manager.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R74.1 | contextual-memory-manager.ts | contextual-memory-manager.test.ts | N-05 |
| FR-R74.2 | contextual-memory-manager.ts | contextual-memory-manager.test.ts | - |
| FR-R74.3 | contextual-memory-manager.ts | contextual-memory-manager.test.ts | - |
| FR-R74.4 | contextual-memory-manager.ts | contextual-memory-manager.test.ts | D-08 |
| FR-R74.5 | contextual-memory-manager.ts | contextual-memory-manager.test.ts | D-06 |
