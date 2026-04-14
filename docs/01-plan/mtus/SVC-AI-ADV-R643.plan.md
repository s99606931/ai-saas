# SVC-AI-ADV-R643 Plan — AI기반 계약 준수 검사 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 (트랙 B 23차) |
| WHO | 공공기관 계약 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R643.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/contract-compliance-checker-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R643.1 | 계약 등록 (contractId, vendor) |
| FR-R643.2 | 준수 조건 평가 (dataGrade? C/S 차단) |
| FR-R643.3 | 계약별 준수율 산출 |
| FR-R643.4 | 미준수 계약 목록 반환 |
| FR-R643.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
