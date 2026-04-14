# SVC-AI-ADV-R683 Plan — AI기반 공공 보조금 자격 심사 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 신청자 프로필 기반 보조금 자격 자동 1차 판정 |
| WHO | 복지부서, 민원창구 |
| RISK | N2SF C/S 차단, applicantId PII 마스킹 |
| SUCCESS | FR-R683.1~5 모두 충족, ≥5 Vitest 통과 |
| SCOPE | platform/services/ai-service/src/lib/public-grant-eligibility-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R683.1 | `defineProgram(program)` 프로그램 정의 (programId, minScore, incomeCap) |
| FR-R683.2 | `assess(application, grade?)` C/S→BLOCKED, applicantId→SHA-256 16자 마스킹 |
| FR-R683.3 | 자격 점수 = needIndex×0.5 + impactScore×0.5, incomeCap 초과 → 즉시 REJECTED |
| FR-R683.4 | 판정: ≥minScore ELIGIBLE / ≥minScore−0.15 REVIEW / REJECTED |
| FR-R683.5 | `getAuditLog()` append-only (DEFINE_PROGRAM/ASSESS) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
