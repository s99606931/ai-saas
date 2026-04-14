# SVC-AI-ADV-R617 Design — AI기반 스마트계약 감사 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R617.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 정규식 기반 패턴 탐지 룰셋
- Reentrancy: `call{value:}` + 이후 `balances` 변경 (단순 휴리스틱)
- `tx.origin` 사용 → HIGH
- `.call.value` / `.send(` unchecked → HIGH
- `block.timestamp` 조건부 판정 → MEDIUM
- `pragma solidity ^0.4` → CRITICAL
- 최종 심각도: findings 중 최고 레벨

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
