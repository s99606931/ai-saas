# SVC-AI-ADV-R671 Plan — AI기반 서비스 의존성 상태 관리 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 의존성 그래프의 상태를 자동 집계·연쇄 영향 평가 |
| WHO | SRE / 플랫폼 운영팀 |
| RISK | 내부 토폴로지 외부 노출 금지 |
| SUCCESS | FR-R671.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/service-dependency-health-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R671.1 | 서비스 노드 등록 (status: HEALTHY/DEGRADED/DOWN) |
| FR-R671.2 | 의존성 전파 평가 — DOWN 상위는 IMPACTED |
| FR-R671.3 | dataGrade C/S 차단 (N2SF N-05) |
| FR-R671.4 | serviceName SHA-256 16자 마스킹 |
| FR-R671.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
