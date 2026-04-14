# SVC-AI-ADV-R687 Design — AI기반 시스템 간 데이터 정합성 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R687.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, sourceEmail SHA-256 16자 마스킹 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/cross-system-reconciler-ai-v2.ts |

## 설계 결정
- `CrossSystemReconcilerAIV2` 클래스
- `reconcile(pair, grade?)`: C/S→BLOCKED
- 공통 key 집합 대상 문자열 비교, 드리프트 = mismatches/totalKeys
- CRITICAL/WARNING/OK 등급
- 권고: HALT_SYNC/AUTO_HEAL/NONE
- `getAuditLog()` 제공

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
