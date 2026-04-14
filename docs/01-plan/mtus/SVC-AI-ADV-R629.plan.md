# SVC-AI-ADV-R629 Plan — AI기반 공공 API 생명주기 관리 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 API 표준 생명주기 관리 |
| WHO | API 운영자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R629.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-api-lifecycle-manager-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R629.1 | API 등록 및 단계 설정 (active/deprecated/retired) |
| FR-R629.2 | 단계 전환 기록 (dataGrade? C/S 차단) |
| FR-R629.3 | deprecation 예상 기간 산출 |
| FR-R629.4 | retire 대상 목록 반환 |
| FR-R629.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
