# SVC-AI-ADV-R683 Design — AI기반 공공 보조금 자격 심사 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R683.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, applicantId SHA-256 16자 마스킹 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/public-grant-eligibility-ai-v2.ts |

## 설계 결정
- `PublicGrantEligibilityAIV2` 클래스
- `defineProgram(p)` minScore 0~1 검증
- `assess(app, grade?)`: C/S→BLOCKED, incomeCap 초과→REJECTED 즉시
- 점수 = needIndex×0.5 + impactScore×0.5
- ELIGIBLE/REVIEW/REJECTED 분기
- `getAuditLog()` 제공

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
