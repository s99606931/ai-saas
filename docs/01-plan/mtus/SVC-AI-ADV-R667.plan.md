# SVC-AI-ADV-R667 Plan — AI기반 동적 가격 최적화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공서비스 부가 요금(주차·시설 대관) 수요 기반 동적 최적화 |
| WHO | 시설 운영부서 / 재정과 |
| RISK | 사용자 식별정보 외부 전송 금지 |
| SUCCESS | FR-R667.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/dynamic-pricing-optimizer-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R667.1 | 수요 기반 가격 추천 (basePrice × demandFactor) |
| FR-R667.2 | 상·하한 클램핑 (0.5×base ~ 2.0×base) |
| FR-R667.3 | dataGrade C/S 차단 (N2SF N-05) |
| FR-R667.4 | facilityOwner SHA-256 16자 마스킹 |
| FR-R667.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
