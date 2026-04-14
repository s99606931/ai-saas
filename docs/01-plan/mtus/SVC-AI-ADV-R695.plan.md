# SVC-AI-ADV-R695 Plan — AI기반 문서 워크플로우 자동화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공문서 기안·결재·시행 워크플로우 자동화 |
| WHO | 총무팀, 문서 관리자 |
| RISK | N2SF C/S 등급 문서 본문 외부 전송 금지, 기안자 PII 마스킹 |
| SUCCESS | FR-R695.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/document-workflow-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R695.1 | 워크플로우 템플릿 등록 (templateId, steps[]) |
| FR-R695.2 | 문서 기안 (dataGrade? C/S 차단, drafterId PII 마스킹 sha256) |
| FR-R695.3 | 진행률 = completed/total*100 |
| FR-R695.4 | 상태 (STALLED pending>7d / ACTIVE / DONE) |
| FR-R695.5 | getAuditLog() append-only (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
