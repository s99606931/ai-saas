# SVC-AI-ADV-R692 Plan — AI기반 공공 인프라 모니터링 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 인프라(네트워크·전력·설비) 이상 패턴 실시간 탐지 |
| WHO | 인프라 운영팀, SRE |
| RISK | N2SF C/S 등급 시설 정보 외부 전송 금지 |
| SUCCESS | FR-R692.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-infrastructure-monitor-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R692.1 | 인프라 자원 등록 (assetId, category, criticality 1~3) |
| FR-R692.2 | 메트릭 수신 (dataGrade? C/S 차단, operatorId PII 마스킹 sha256) |
| FR-R692.3 | 건강도 = 100 - utilization - errorRate*2 |
| FR-R692.4 | 상태 (CRITICAL<40 / DEGRADED<70 / HEALTHY) |
| FR-R692.5 | getAuditLog() append-only (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
