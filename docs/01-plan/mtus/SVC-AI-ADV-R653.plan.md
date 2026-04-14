# SVC-AI-ADV-R653 Plan — AI기반 기관 간 데이터 브로커 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 기관 간 데이터 교환의 분류·마스킹·중계 자동화 |
| WHO | 데이터 연계 담당 |
| RISK | N2SF C/S 등급 원본 데이터 교환 절대 금지 |
| SUCCESS | FR-R653.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/cross-agency-data-broker-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R653.1 | 교환 요청 등록 (requestId, from, to, dataset) |
| FR-R653.2 | 등급 검증 (dataGrade? C/S 차단) |
| FR-R653.3 | 교환 허용 여부 판정 (ALLOW/MASK/DENY) |
| FR-R653.4 | requesterEmail SHA-256 16자 hex 마스킹 |
| FR-R653.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
