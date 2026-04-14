# SVC-AI-ADV-R652 Plan — AI기반 스마트 아카이빙 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 문서·데이터 자동 아카이빙·보존기간 관리 |
| WHO | 기록물 관리 담당 |
| RISK | N2SF C/S 등급 기록물 외부 전송 금지 |
| SUCCESS | FR-R652.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/smart-archiving-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R652.1 | 기록 등록 (recordId, createdAt, retentionYears) |
| FR-R652.2 | 보존 상태 판정 (dataGrade? C/S 차단) |
| FR-R652.3 | 자동 아카이빙 (ACTIVE/ARCHIVE/DISPOSAL) |
| FR-R652.4 | 폐기 대상 목록 (ageYears ≥ retentionYears) |
| FR-R652.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
