# SVC-AI-ADV-R83 — Conversation Context Pruner

> 2026-04-12 | v1.0.0 | PM Lead (9차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 대화 토큰 사용량 최적화 → LLM 비용 절감 | 토큰 절감율 ≥ 40% |
| 기술 | 중요도 점수 기반 턴 선택 + 요약 대체 + 하드 한도 | 한도 초과 0건 |
| 보안 | PII 포함 턴 자동 마스킹, C/S 등급 차단 | N2SF N-05 |
| 규정 | 압축 감사 추적 + 원본 보존 옵션 | CSAP D-06 |

## Context Anchor
- **WHY**: 긴 대화는 LLM 토큰 한도를 초과하고 비용을 폭증시킨다. `conversational-memory.ts`가 단기/장기 메모리를 구분 저장한다면, R83은 *압축 알고리즘*에 특화 — 점수 기반 턴 선택, 요약 대체, 하드 한도 강제.
- **WHO**: AI 플랫폼팀, 비용 관리자, 운영팀
- **RISK**: 중요 맥락 유실, 요약 왜곡, 토큰 한도 초과
- **SUCCESS**: 40+ 턴 대화를 20턴 내로 압축, 토큰 40% 이상 절감, 키워드 유지율 ≥ 85%
- **SCOPE**:
  - IN — 턴 중요도 산정(길이/질문/키워드/최신), 요약 대체(executor), 한도 강제
  - OUT — 실제 요약 LLM 호출(주입), 영구 저장

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R83.1 | 대화 턴 입력 + 등급 guard + PII 마스킹 | conversation-context-pruner.ts |
| FR-R83.2 | 턴 중요도 점수(길이+역할+키워드+최신) 산정 | conversation-context-pruner.ts |
| FR-R83.3 | 토큰 한도 기반 턴 선택 + 낮은 점수 제거/요약 | conversation-context-pruner.ts |
| FR-R83.4 | 요약 executor 주입 + 요약 턴 삽입 | conversation-context-pruner.ts |
| FR-R83.5 | getAuditLog + 이벤트(PRUNE/SUMMARIZED/MASKED/BLOCKED) | conversation-context-pruner.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R83.1 | conversation-context-pruner.ts | conversation-context-pruner.test.ts | N-05 |
| FR-R83.2 | conversation-context-pruner.ts | conversation-context-pruner.test.ts | - |
| FR-R83.3 | conversation-context-pruner.ts | conversation-context-pruner.test.ts | - |
| FR-R83.4 | conversation-context-pruner.ts | conversation-context-pruner.test.ts | - |
| FR-R83.5 | conversation-context-pruner.ts | conversation-context-pruner.test.ts | D-06 |
