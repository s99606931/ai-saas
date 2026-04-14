# SVC-AI-ADV-R630 Plan — AI기반 민원인 데이터 프라이버시 보호 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원인 PII 보호 및 마스킹 자동화 |
| WHO | 개인정보보호 담당자 |
| RISK | PII 유출 위험 |
| SUCCESS | FR-R630.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/citizen-data-privacy-guardian-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R630.1 | PII 필드 등록 |
| FR-R630.2 | PII 마스킹 (SHA-256 16자 hex) |
| FR-R630.3 | 민원인 데이터 분류 및 C/S 차단 |
| FR-R630.4 | 마스킹 통계 집계 |
| FR-R630.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
