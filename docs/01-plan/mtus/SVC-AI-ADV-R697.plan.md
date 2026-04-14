# SVC-AI-ADV-R697 Plan — AI기반 장애 상관관계 분석 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 연쇄 장애 이벤트 간 상관관계 자동 분석으로 근본원인 식별 |
| WHO | SRE, 인시던트 커맨더 |
| RISK | N2SF C/S 등급 장애 로그 외부 전송 금지 |
| SUCCESS | FR-R697.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/incident-correlation-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R697.1 | 인시던트 등록 (incidentId, service, severity 1~5) |
| FR-R697.2 | 이벤트 기록 (dataGrade? C/S 차단, responderId PII 마스킹 sha256) |
| FR-R697.3 | 상관점수 = sameService*0.5 + within5min*0.3 + severityDelta*0.2 |
| FR-R697.4 | 판정 (ROOT_CAUSE≥0.8 / RELATED≥0.5 / UNRELATED) |
| FR-R697.5 | getAuditLog() append-only (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
