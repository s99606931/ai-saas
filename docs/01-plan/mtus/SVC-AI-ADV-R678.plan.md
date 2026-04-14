# SVC-AI-ADV-R678 Plan — AI기반 공공 인력 최적화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 부서별 업무량 기반 인력 배치 권고 |
| WHO | 인사팀, 부서장 |
| RISK | N2SF C/S 등급 직원 정보 외부 전송 금지 |
| SUCCESS | FR-R678.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-workforce-optimizer-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R678.1 | 부서 등록 (deptId, name, headcount) |
| FR-R678.2 | 업무량 보고 (dataGrade? C/S 차단) |
| FR-R678.3 | 부하 등급 (OVERLOADED/BUSY/NORMAL) |
| FR-R678.4 | 권고 (HIRE/REASSIGN/HOLD) |
| FR-R678.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
