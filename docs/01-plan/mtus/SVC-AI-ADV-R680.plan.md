# SVC-AI-ADV-R680 Plan — AI기반 재해 복구 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | RTO/RPO 기반 재해 복구 자동 권고 |
| WHO | DR팀, SRE |
| RISK | N2SF C/S 등급 인프라 정보 외부 전송 금지 |
| SUCCESS | FR-R680.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-powered-disaster-recovery-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R680.1 | 시스템 등록 (systemId, name, tier) |
| FR-R680.2 | 장애 평가 (dataGrade? C/S 차단) |
| FR-R680.3 | 영향 등급 (CATASTROPHIC/MAJOR/MINOR) |
| FR-R680.4 | 복구 권고 (FAILOVER/RESTORE/MONITOR) |
| FR-R680.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
