# SVC-AI-ADV-R691 Plan — AI기반 데이터 스튜어드 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 데이터 스튜어드 업무(품질·분류·이슈 관리) 자동화 |
| WHO | 데이터 거버넌스팀, CDO |
| RISK | N2SF C/S 등급 데이터셋 외부 전송 금지, 담당자 PII 마스킹 |
| SUCCESS | FR-R691.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-data-steward-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R691.1 | 데이터셋 등록 (datasetId, owner, qualityScore) |
| FR-R691.2 | 이슈 보고 (dataGrade? C/S 차단, stewardId PII 마스킹 sha256) |
| FR-R691.3 | 스튜어드십 점수 = qualityScore - pendingIssues*5 |
| FR-R691.4 | 권고 (ACTION_REQUIRED<50 / REVIEW<80 / HEALTHY) |
| FR-R691.5 | getAuditLog() append-only 감사 로그 (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
