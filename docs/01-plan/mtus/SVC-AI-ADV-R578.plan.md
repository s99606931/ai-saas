# SVC-AI-ADV-R578 Plan — AI기반 공공 서비스 만족도 측정 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 서비스 만족도 실시간 집계로 품질 개선 근거 제공 |
| WHO | 서비스 품질 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지; PII(userId) 마스킹 |
| SUCCESS | 만족도 기록, 평균 산출, 저만족 서비스 식별 |
| SCOPE | public-satisfaction-measurer-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R578.1 | 서비스 등록 (serviceId, name) |
| FR-R578.2 | 만족도 기록 (serviceId, userId, score 1~5, dataGrade?) — C/S 차단, userId SHA-256 마스킹 |
| FR-R578.3 | 평균 만족도 반환 |
| FR-R578.4 | 저만족 서비스 목록 반환 (평균 < 3.0) |
| FR-R578.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
