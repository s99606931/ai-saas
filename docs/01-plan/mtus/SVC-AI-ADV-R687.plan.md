# SVC-AI-ADV-R687 Plan — AI기반 시스템 간 데이터 정합성 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 이기종 시스템 간 데이터 불일치 자동 탐지 및 복구 권고 |
| WHO | 데이터팀, 플랫폼팀 |
| RISK | N2SF C/S 차단, 대조값 메타에 sourceEmail 마스킹 |
| SUCCESS | FR-R687.1~5 모두 충족, ≥5 Vitest 통과 |
| SCOPE | platform/services/ai-service/src/lib/cross-system-reconciler-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R687.1 | `reconcile(pair, grade?)` C/S→BLOCKED, sourceEmail→SHA-256 16자 마스킹 |
| FR-R687.2 | 필드별 문자열 비교, 불일치 수 / 전체 필드 수 = 드리프트 비율 |
| FR-R687.3 | 등급: ≥0.3 CRITICAL / ≥0.1 WARNING / OK |
| FR-R687.4 | 권고: CRITICAL→HALT_SYNC / WARNING→AUTO_HEAL / OK→NONE |
| FR-R687.5 | `getAuditLog()` append-only (RECONCILE) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
