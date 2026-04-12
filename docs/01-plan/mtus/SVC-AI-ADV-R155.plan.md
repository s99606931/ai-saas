# MTU Plan — SVC-AI-ADV-R155 Context Budget Optimizer

> **원 요청 번호**: R155
> **모듈**: `platform/services/ai-service/src/lib/context-budget-optimizer.ts`
> **주**: 기존 `context-window-manager.ts`(R21)와 역할 분리 — 본 모듈은 "우선순위 기반 선택·드롭" 단일 책임.

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 다수 후보 컨텍스트 조각을 토큰 예산 내로 선택 → AI 호출 비용 절감 |
| 기술 | knapsack 근사 (priority 내림차순 + 토큰 합계 제한) |
| 보안 | 민감 등급 조각 자동 차단 |
| 규제 | CSAP D-12, N2SF N-05 |

## Context Anchor

- WHY: RAG/에이전트가 수집한 조각이 예산을 초과 → 수동 선택 비효율
- WHO: RAG 파이프라인, Agent Orchestrator
- RISK: 핵심 조각 누락 시 응답 품질 저하
- SUCCESS: 우선순위 높은 조각부터 예산 한도까지 선택, 드롭 목록 반환
- SCOPE: addItem → selectWithinBudget(budget) → {selected, dropped, usedTokens}

## FR

| ID | 설명 |
|----|------|
| FR-R155.1 | addItem(id, content, tokens, priority) 등록 |
| FR-R155.2 | priority 내림차순 정렬, 동점 시 tokens 오름차순 |
| FR-R155.3 | selectWithinBudget(budget): priority 순회하여 누적 토큰 ≤ budget 조각만 선택 |
| FR-R155.4 | dropped: 선택되지 않은 id 목록 |
| FR-R155.5 | usedTokens: 선택된 토큰 합 |
| FR-R155.6 | utilization: usedTokens / budget |
| FR-R155.7 | reset(), getAuditLog |
| FR-R155.8 | C/S 등급 차단, 중복 id 거부, 빈 content 거부, budget <= 0 거부 |

## 테스트 케이스

- 예산 충분 → 전부 선택
- 예산 부족 → priority 순 선택
- 동점 priority → tokens 작은 것 우선
- dropped 정확성
- utilization 계산
- reset
- 중복 id 거부
- 빈 content 거부
- C/S 차단
