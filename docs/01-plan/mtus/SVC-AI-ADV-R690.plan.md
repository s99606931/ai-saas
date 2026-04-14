# SVC-AI-ADV-R690 Plan — AI기반 서비스 설계도 자동 생성 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 요건 입력 → 구성요소/의존성 설계도 자동 생성 |
| WHO | 아키텍처팀, 신규 서비스 기획 |
| RISK | N2SF C/S 차단 |
| SUCCESS | FR-R690.1~5 모두 충족, ≥5 Vitest 통과 |
| SCOPE | platform/services/ai-service/src/lib/service-blueprint-generator-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R690.1 | `generate(requirement, grade?)` C/S→BLOCKED |
| FR-R690.2 | 구성요소 결정: needsAuth→AUTH, needsDb→DB, needsCache→CACHE, needsQueue→QUEUE, 항상 API·LOG 포함 |
| FR-R690.3 | 복잡도 = 구성요소 수, ≥5 HIGH / ≥3 MEDIUM / LOW |
| FR-R690.4 | 권고: HIGH→REVIEW_ARCH / MEDIUM→STANDARD / LOW→LIGHTWEIGHT |
| FR-R690.5 | `getAuditLog()` append-only (GENERATE) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
