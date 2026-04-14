# SVC-AI-ADV-R638 Plan — AI기반 공공 클라우드 비용 배분 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 (트랙 B 23차) |
| WHO | 공공기관 재무/운영 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R638.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-cloud-cost-allocator-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R638.1 | 부서/프로젝트 등록 |
| FR-R638.2 | 비용 사용량 기록 (dataGrade? C/S 차단) |
| FR-R638.3 | 부서별 배분 금액 산출 |
| FR-R638.4 | 초과 사용 부서 목록 반환 |
| FR-R638.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
