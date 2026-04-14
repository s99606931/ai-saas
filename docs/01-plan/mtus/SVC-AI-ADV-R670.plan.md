# SVC-AI-ADV-R670 Plan — AI기반 데이터 보존 정책 자동화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 데이터 종류·등급별 보존 기간 자동 결정·만료 처리 |
| WHO | 정보보호 / 기록물 관리 부서 |
| RISK | 공공기록물법 보존 기간 위반 금지 |
| SUCCESS | FR-R670.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/data-retention-policy-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R670.1 | 카테고리별 보존 기간 결정 (audit/health/citizen/temp) |
| FR-R670.2 | 만료 여부 판정 (createdAt + 보존기간 vs now) |
| FR-R670.3 | dataGrade C/S 차단 (N2SF N-05) |
| FR-R670.4 | recordOwner SHA-256 16자 마스킹 |
| FR-R670.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
