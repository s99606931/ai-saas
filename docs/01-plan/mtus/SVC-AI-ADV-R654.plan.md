# SVC-AI-ADV-R654 Plan — AI기반 선제적 보안 패치 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | CVE/취약점 기반 선제적 패치 우선순위 산출 |
| WHO | 보안 운영팀 |
| RISK | N2SF C/S 등급 자산 정보 외부 전송 금지 |
| SUCCESS | FR-R654.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/proactive-security-patching-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R654.1 | 자산 등록 (assetId, component, version) |
| FR-R654.2 | 취약점 등록 (dataGrade? C/S 차단) |
| FR-R654.3 | CVSS 기반 우선순위 산출 (CRITICAL/HIGH/MEDIUM/LOW) |
| FR-R654.4 | 패치 권고 (IMMEDIATE/SCHEDULED/MONITOR) |
| FR-R654.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
