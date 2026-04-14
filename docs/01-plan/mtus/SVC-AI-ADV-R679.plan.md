# SVC-AI-ADV-R679 Plan — AI기반 분산 추적 분석 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 트레이스 span 기반 병목 자동 식별 |
| WHO | SRE, 백엔드팀 |
| RISK | N2SF C/S 등급 trace payload 외부 전송 금지 |
| SUCCESS | FR-R679.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/distributed-tracing-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R679.1 | 트레이스 등록 (traceId, rootService, totalMs) |
| FR-R679.2 | Span 분석 (dataGrade? C/S 차단) |
| FR-R679.3 | 병목 등급 (CRITICAL/HIGH/LOW) |
| FR-R679.4 | 권고 (OPTIMIZE/PROFILE/IGNORE) |
| FR-R679.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
