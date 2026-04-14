# SVC-AI-ADV-R659 Plan — AI기반 민원인 리스크 프로파일링 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원 폭주/위협 사전 식별 + 응대 우선순위 산출 |
| WHO | 민원 처리 부서 |
| RISK | 민원인 PII 보호 (N2SF C/S 차단) |
| SUCCESS | FR-R659.1~6 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/citizen-risk-profiler-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R659.1 | 민원 이벤트 등록 (citizenId, eventType, dataGrade) — C/S 차단 |
| FR-R659.2 | 위험 점수 산출 (이벤트 빈도 + 위협 키워드) |
| FR-R659.3 | 위험 등급 (HIGH/MEDIUM/LOW) |
| FR-R659.4 | citizenId SHA-256 마스킹 |
| FR-R659.5 | 우선 응대 큐 조회 (HIGH 먼저) |
| FR-R659.6 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
