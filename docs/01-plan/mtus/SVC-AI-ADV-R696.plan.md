# SVC-AI-ADV-R696 Plan — AI기반 멀티테넌트 비용 최적화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 다중 기관(테넌트)별 리소스 사용·비용 최적화 권고 |
| WHO | 운영팀, FinOps |
| RISK | N2SF C/S 등급 사용량 로그 외부 전송 금지 |
| SUCCESS | FR-R696.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/multi-tenant-cost-optimizer-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R696.1 | 테넌트 등록 (tenantId, budget) |
| FR-R696.2 | 사용 리포트 (dataGrade? C/S 차단, contactId PII 마스킹 sha256) |
| FR-R696.3 | 낭비율 = idleCost/totalCost*100 |
| FR-R696.4 | 권고 (RESIZE≥30% / REVIEW≥15% / OK) |
| FR-R696.5 | getAuditLog() append-only (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
