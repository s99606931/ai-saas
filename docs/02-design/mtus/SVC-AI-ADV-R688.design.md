# SVC-AI-ADV-R688 Design — AI기반 민원인 생애주기 관리 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R688.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, citizenId SHA-256 16자 마스킹 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/citizen-lifecycle-manager-ai-v2.ts |

## 설계 결정
- `CitizenLifecycleManagerAIV2` 클래스
- `updateContact(event, grade?)`: C/S→BLOCKED, citizenId 마스킹
- Stage: contacts 0 NEW / 1~2 ACTIVE / ≥3 LOYAL (sat≥0.7) / sat<0.4 AT_RISK (우선)
- Action: ONBOARD/NURTURE/REWARD/INTERVENE
- `getStage(maskedId)` / `getAuditLog()` 제공

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
