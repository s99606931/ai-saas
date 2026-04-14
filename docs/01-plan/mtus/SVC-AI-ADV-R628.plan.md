# SVC-AI-ADV-R628 Plan — AI기반 워크플로우 버전 관리 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 |
| WHO | 워크플로우 운영자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R628.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-workflow-versioning-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R628.1 | 워크플로우 신규 버전 등록 |
| FR-R628.2 | 버전 변경점 기록 (dataGrade? C/S 차단) |
| FR-R628.3 | 최신 버전 조회 |
| FR-R628.4 | 버전 비교 및 회귀 경고 |
| FR-R628.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
