# SVC-AI-ADV-R694 Plan — AI기반 서비스 메시 서킷브레이커 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 메시 호출 실패율 기반 동적 서킷브레이커 |
| WHO | SRE, 플랫폼 엔지니어 |
| RISK | N2SF C/S 등급 호출 메타 외부 전송 금지 |
| SUCCESS | FR-R694.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/service-mesh-circuit-breaker-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R694.1 | 서비스 등록 (serviceId, failureThreshold 0~1) |
| FR-R694.2 | 호출 결과 기록 (dataGrade? C/S 차단, callerId PII 마스킹 sha256) |
| FR-R694.3 | 실패율 = failures/total |
| FR-R694.4 | 상태 (OPEN ≥ threshold / HALF_OPEN ≥ threshold/2 / CLOSED) |
| FR-R694.5 | getAuditLog() append-only (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
