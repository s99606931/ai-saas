# SVC-AI-ADV-R688 Plan — AI기반 민원인 생애주기 관리 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원인 접촉 이력 기반 생애주기 단계 산출 및 다음 액션 권고 |
| WHO | 민원실, 정책기획 |
| RISK | N2SF C/S 차단, citizenId PII 마스킹 |
| SUCCESS | FR-R688.1~5 모두 충족, ≥5 Vitest 통과 |
| SCOPE | platform/services/ai-service/src/lib/citizen-lifecycle-manager-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R688.1 | `updateContact(event, grade?)` C/S→BLOCKED, citizenId→SHA-256 16자 마스킹 |
| FR-R688.2 | 단계 산출: contacts 0 NEW / 1~2 ACTIVE / ≥3 && satisfaction≥0.7 LOYAL / satisfaction<0.4 AT_RISK |
| FR-R688.3 | 액션: NEW→ONBOARD / ACTIVE→NURTURE / LOYAL→REWARD / AT_RISK→INTERVENE |
| FR-R688.4 | `getStage(maskedId)` 단계 조회 |
| FR-R688.5 | `getAuditLog()` append-only (UPDATE_CONTACT) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
