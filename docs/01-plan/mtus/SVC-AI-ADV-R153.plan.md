# MTU Plan — SVC-AI-ADV-R153 Multi-Turn Memory Compactor

> **원 요청 번호**: R153
> **모듈**: `platform/services/ai-service/src/lib/multi-turn-memory-compactor.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 장기 다중 턴 대화 메모리를 자동 압축 → 토큰 예산 절약 + 핵심 보존 |
| 기술 | 토큰 budget 초과 시 오래된 턴부터 요약 치환, pinned 턴은 보존 |
| 보안 | 압축 전후 감사, C/S 등급 데이터 차단 |
| 규제 | CSAP D-12, N2SF N-05 O등급 데이터만 처리 |

## Context Anchor

- WHY: 다중 턴 대화가 길어지면 컨텍스트 윈도우 초과 → 대화 단절
- WHO: AI Agent, 대화형 검색 API
- RISK: 누락된 핵심 사실로 인한 응답 품질 저하
- SUCCESS: 토큰 예산 준수 + pinned 메시지 100% 보존 + 요약 감사
- SCOPE: appendTurn → compactIfNeeded(budget) → getCompactedHistory

## FR

| ID | 설명 |
|----|------|
| FR-R153.1 | appendTurn(role, content, {pinned, tokens?}) 추가 |
| FR-R153.2 | estimateTokens(text) = 공백 분할 단어수 (tokens 제공 시 그대로) |
| FR-R153.3 | totalTokens() = 전체 턴 토큰 합 |
| FR-R153.4 | compactIfNeeded(budget): total <= budget 이면 noop |
| FR-R153.5 | 압축 전략: 오래된(pinned=false) 연속 턴을 요약 턴 1개로 치환 — `[SUMMARY: n turns, topics=...]` |
| FR-R153.6 | pinned 턴과 최근 N개(기본 2)는 항상 보존 |
| FR-R153.7 | 여전히 budget 초과 시 가장 오래된 일반 턴 삭제 반복 |
| FR-R153.8 | getCompactedHistory() 반환 |
| FR-R153.9 | reset(), getAuditLog(), C/S 등급 차단, 빈 content 거부 |

## 테스트 케이스

- budget 이하 → 압축 없음
- budget 초과 → 요약 턴 1개 생성, total <= budget
- pinned 턴은 항상 보존
- 최근 2턴 보존
- 요약 불충분 시 가장 오래된 삭제
- reset 동작
- 빈 content 거부 / C·S 차단
- getAuditLog 기록
