# SVC-AI-ADV-R675 Plan — AI기반 코드 리팩토링 자문 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 코드 복잡도 지표 기반 리팩토링 우선순위 자동 산출 |
| WHO | 개발팀, 코드 품질 담당관 |
| RISK | N2SF C/S 등급 코드/메타데이터 외부 전송 금지 |
| SUCCESS | FR-R675.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-code-refactoring-advisor-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R675.1 | 모듈 등록 (moduleId, language, loc) |
| FR-R675.2 | 메트릭 분석 (dataGrade? C/S 차단) |
| FR-R675.3 | 복잡도 등급 산출 (CRITICAL/HIGH/MODERATE) |
| FR-R675.4 | 리팩토링 권고 (SPLIT/SIMPLIFY/REVIEW) |
| FR-R675.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
