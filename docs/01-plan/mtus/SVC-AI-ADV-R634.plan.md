# SVC-AI-ADV-R634 Plan — AI기반 도메인 간 데이터 연계 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 이종 공공 도메인 데이터 연계 정확도 향상 |
| WHO | 데이터 플랫폼 운영자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R634.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/cross-domain-data-linker-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R634.1 | 도메인 등록 |
| FR-R634.2 | 연계 레코드 추가 (dataGrade? C/S 차단) |
| FR-R634.3 | 도메인 쌍의 매칭 비율 산출 |
| FR-R634.4 | 낮은 매칭률 도메인 목록 반환 |
| FR-R634.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
