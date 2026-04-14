# SVC-AI-ADV-R705 Plan — AI기반 정책 준수 검증 v4

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 조직 정책(CSAP/N2SF/ISMS-P) 위반 여부 선제 탐지·경고 |
| WHO | 정보보호팀, 감사팀 |
| RISK | N2SF C/S 데이터 금지, 정책 대상 자원 식별자 마스킹 |
| SUCCESS | FR-R705.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/policy-compliance-validator-v4.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R705.1 | 정책 등록 (policyId, rule: 속성→허용값[], severity) |
| FR-R705.2 | 자원 평가 (resourceId, attrs, grade?) - C/S 차단 |
| FR-R705.3 | 위반 판정 및 심각도별 리스크 점수 집계 |
| FR-R705.4 | 전체 위반 목록 조회 (심각도 내림차순) |
| FR-R705.5 | getAuditLog() append-only (resourceId 마스킹) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
